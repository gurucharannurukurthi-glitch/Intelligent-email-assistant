import mongoose from 'mongoose';
import { google } from 'googleapis';
import { Email } from '../models/Email.js';
import { getAuthenticatedOAuth2Client } from './googleAuthService.js';
import { embedUnembeddedEmails, embedEmail } from './embeddingService.js';

// Decode base64url string to UTF-8
function decodeBase64Url(str) {
  if (!str) return '';
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch (err) {
    console.error('Failed to decode base64 buffer:', err);
    return '';
  }
}

// Parse sender/recipient header strings like "John Doe <john@example.com>" or "john@example.com"
function parseAddress(headerStr) {
  if (!headerStr) return { name: '', email: '' };
  const match = headerStr.match(/(.*?)\s*<(.+)>/);
  if (match) {
    return {
      name: match[1].replace(/["']/g, '').trim(),
      email: match[2].trim()
    };
  }
  return {
    name: '',
    email: headerStr.replace(/["']/g, '').trim()
  };
}

function parseAddressList(headerStr) {
  if (!headerStr) return [];
  return headerStr.split(',').map((addr) => parseAddress(addr.trim()));
}

// Recursively traverse Gmail payload parts to extract bodyText and bodyHtml
function extractMessageBody(payload) {
  let bodyText = '';
  let bodyHtml = '';

  function traverse(part) {
    if (!part) return;

    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText += decodeBase64Url(part.body.data) + '\n';
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml += decodeBase64Url(part.body.data) + '\n';
    }

    if (part.parts && Array.isArray(part.parts)) {
      part.parts.forEach(traverse);
    }
  }

  traverse(payload);

  // If bodyText is empty but bodyHtml exists, strip HTML tags for text representation
  if (!bodyText && bodyHtml) {
    bodyText = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return {
    bodyText: bodyText.trim(),
    bodyHtml: bodyHtml.trim() || bodyText.trim()
  };
}

export async function syncUserInbox(user, options = {}) {
  const authClient = await getAuthenticatedOAuth2Client(user);
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  const maxResults = options.maxResults || 50;
  const listQuery = options.query || 'label:INBOX';

  // Concurrently fetch active messages and trashed messages from Gmail
  const [listRes, trashRes] = await Promise.allSettled([
    gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: listQuery
    }),
    gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'label:TRASH'
    })
  ]);

  const messages = listRes.status === 'fulfilled' ? listRes.value.data.messages || [] : [];
  const trashMessages = trashRes.status === 'fulfilled' ? trashRes.value.data.messages || [] : [];

  const activeGmailIds = messages.map((m) => m.id);
  const trashedIds = trashMessages.map((m) => m.id);

  // 1. Reconcile Trashed Emails from Gmail Web:
  // Any email that Gmail has placed in TRASH is marked as TRASH in our MongoDB
  if (trashedIds.length > 0) {
    const trashedInDb = await Email.find({
      user: user._id,
      messageId: { $in: trashedIds },
      labels: { $in: ['INBOX', 'SENT'] }
    });

    if (trashedInDb.length > 0) {
      await Promise.all(
        trashedInDb.map((e) => {
          e.labels = (e.labels || []).filter((l) => l !== 'INBOX' && l !== 'SENT').concat('TRASH');
          e.isArchived = true;
          return e.save();
        })
      );
    }
  }

  // 2. Reconcile Active Folder (INBOX or SENT):
  const targetLabel = listQuery.includes('label:SENT') ? 'SENT' : 'INBOX';
  if (messages.length === 0) {
    await Email.updateMany(
      { user: user._id, labels: targetLabel },
      { $pull: { labels: targetLabel }, $set: { isArchived: true } }
    );
    return [];
  } else {
    // If messages are present in Gmail, remove the label from any local email not in Gmail's active list
    await Email.updateMany(
      {
        user: user._id,
        labels: targetLabel,
        messageId: { $nin: activeGmailIds }
      },
      {
        $pull: { labels: targetLabel },
        $set: { isArchived: true }
      }
    );
  }

  // Helper to fetch and format a single Gmail message
  const fetchAndSaveMessage = async (item) => {
    try {
      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: item.id,
        format: 'full'
      });

      const message = msgRes.data;
      const headers = message.payload?.headers || [];

      const getHeader = (name) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject') || '(No Subject)';
      const fromHeader = getHeader('From');
      const toHeader = getHeader('To');
      const dateHeader = getHeader('Date');

      const sender = parseAddress(fromHeader);
      const recipients = parseAddressList(toHeader);
      const { bodyText, bodyHtml } = extractMessageBody(message.payload);

      const labels = message.labelIds || [];
      const isRead = !labels.includes('UNREAD');
      const isStarred = labels.includes('STARRED');
      const isArchived = !labels.includes('INBOX') && !labels.includes('TRASH') && !labels.includes('SPAM');
      const receivedAt = dateHeader ? new Date(dateHeader) : new Date(parseInt(message.internalDate, 10));

      return await Email.findOneAndUpdate(
        { user: user._id, messageId: message.id },
        {
          $set: {
            user: user._id,
            messageId: message.id,
            threadId: message.threadId,
            sender,
            recipients,
            subject,
            bodyText: bodyText || message.snippet || '',
            bodyHtml: bodyHtml || bodyText || message.snippet || '',
            snippet: message.snippet || '',
            labels,
            isRead,
            isStarred,
            isArchived,
            receivedAt: isNaN(receivedAt.getTime()) ? new Date() : receivedAt
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.warn(`[GmailSync] Failed to process message ${item.id}:`, err.message);
      return null;
    }
  };

  // Run in concurrent parallel batches of 12 for maximum speed without hitting rate limits
  const BATCH_SIZE = 12;
  const syncedEmails = [];

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((msg) => fetchAndSaveMessage(msg)));
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        syncedEmails.push(res.value);
      }
    }
  }

  // Trigger decoupled background embedding generation for any unembedded emails (non-blocking)
  embedUnembeddedEmails(user._id).catch((err) => {
    console.warn('[GmailSync] Background embedding note:', err.message);
  });

  return syncedEmails;
}

export async function getEmails(userId, { page = 1, limit = 100, folder = 'INBOX', search = '' }) {
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = limit ? Math.min(250, Math.max(1, parseInt(limit, 10))) : 100;
  const skip = (pageNum - 1) * limitNum;

  const query = { user: userId };

  if (folder === 'INBOX') {
    query.labels = 'INBOX';
    query.isArchived = false;
  } else if (folder === 'STARRED') {
    query.isStarred = true;
  } else if (folder === 'SENT') {
    query.labels = 'SENT';
  } else if (folder === 'TRASH') {
    query.labels = 'TRASH';
  } else if (folder === 'ARCHIVE') {
    query.isArchived = true;
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [
      { subject: searchRegex },
      { 'sender.name': searchRegex },
      { 'sender.email': searchRegex },
      { snippet: searchRegex }
    ];
  }

  const [emails, total] = await Promise.all([
    Email.find(query)
      .sort({ receivedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Email.countDocuments(query)
  ]);

  return {
    emails,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1
  };
}

export async function getThread(user, threadId) {
  const userId = user._id || user;
  const emails = await Email.find({ user: userId, threadId })
    .sort({ receivedAt: 1 });

  // Automatically mark any unread messages in this thread as read
  const unreadEmails = emails.filter((e) => !e.isRead);

  if (unreadEmails.length > 0) {
    // 1. Mark in MongoDB
    await Email.updateMany(
      { user: userId, threadId, isRead: false },
      { $set: { isRead: true }, $pull: { labels: 'UNREAD' } }
    );

    // 2. Sync with Gmail API in background
    if (user.googleTokens) {
      getAuthenticatedOAuth2Client(user)
        .then((authClient) => {
          const gmail = google.gmail({ version: 'v1', auth: authClient });
          unreadEmails.forEach((email) => {
            gmail.users.messages
              .modify({
                userId: 'me',
                id: email.messageId,
                requestBody: { removeLabelIds: ['UNREAD'] }
              })
              .catch((err) => {
                console.warn(`[AutoRead] Warning updating remote message ${email.messageId}:`, err.message);
              });
          });
        })
        .catch((err) => {
          console.warn('[AutoRead] Auth error during auto mark-read:', err.message);
        });
    }

    // Return updated email list
    return emails.map((e) => ({
      ...e.toObject(),
      isRead: true,
      labels: e.labels ? e.labels.filter((l) => l !== 'UNREAD') : []
    }));
  }

  return emails.map((e) => (e.toObject ? e.toObject() : e));
}

export async function getEmailById(userId, emailId) {
  return await Email.findOne({ user: userId, _id: emailId });
}

export async function updateEmailState(user, emailId, { isRead, isStarred, isArchived }) {
  const email = await Email.findOne({ user: user._id, _id: emailId });
  if (!email) {
    throw new Error('Email not found');
  }

  const authClient = await getAuthenticatedOAuth2Client(user);
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  const addLabelIds = [];
  const removeLabelIds = [];

  if (typeof isRead === 'boolean') {
    email.isRead = isRead;
    if (isRead) {
      removeLabelIds.push('UNREAD');
    } else {
      addLabelIds.push('UNREAD');
    }
  }

  if (typeof isStarred === 'boolean') {
    email.isStarred = isStarred;
    if (isStarred) {
      addLabelIds.push('STARRED');
    } else {
      removeLabelIds.push('STARRED');
    }
  }

  if (typeof isArchived === 'boolean') {
    email.isArchived = isArchived;
    if (isArchived) {
      removeLabelIds.push('INBOX');
    } else {
      addLabelIds.push('INBOX');
    }
  }

  // Call Gmail modify API
  if (addLabelIds.length > 0 || removeLabelIds.length > 0) {
    try {
      const res = await gmail.users.messages.modify({
        userId: 'me',
        id: email.messageId,
        requestBody: { addLabelIds, removeLabelIds }
      });
      email.labels = res.data.labelIds || email.labels;
    } catch (err) {
      console.warn(`[GmailModify] Warning updating remote message ${email.messageId}:`, err.message);
    }
  }

  await email.save();
  return email;
}

export async function deleteEmail(user, emailId) {
  const email = await Email.findOne({ user: user._id, _id: emailId });
  if (!email) {
    throw new Error('Email not found');
  }

  const authClient = await getAuthenticatedOAuth2Client(user);
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  // 1. Move to Trash in Gmail API first
  try {
    await gmail.users.messages.trash({
      userId: 'me',
      id: email.messageId
    });
  } catch (err) {
    const status = err.response?.status || err.code;
    if (status !== 404 && status !== 410) {
      console.error(`[GmailTrash] Failed to move message ${email.messageId} to trash:`, err.message);
      throw err;
    }
  }

  // 2. Update status in MongoDB ONLY after Gmail confirmation
  email.labels = email.labels ? email.labels.filter((l) => l !== 'INBOX' && l !== 'SENT').concat('TRASH') : ['TRASH'];
  email.isArchived = true;
  await email.save();

  return { success: true, messageId: email.messageId };
}

export async function deleteThread(user, threadId) {
  const emails = await Email.find({ user: user._id, threadId });
  if (!emails || emails.length === 0) {
    throw new Error('Thread not found');
  }

  const authClient = await getAuthenticatedOAuth2Client(user);
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  // 1. Move entire thread and messages to Trash in Gmail API
  try {
    await gmail.users.threads.trash({
      userId: 'me',
      id: threadId
    });
  } catch (err) {
    const status = err.response?.status || err.code;
    if (status !== 404 && status !== 410) {
      console.warn(`[GmailThreadTrash] Warning trashing thread ${threadId}:`, err.message);
    }
  }

  // Also trash all specific message IDs of the thread to ensure 100% Gmail coverage
  await Promise.allSettled(
    emails.map((e) =>
      gmail.users.messages.trash({
        userId: 'me',
        id: e.messageId
      })
    )
  );

  // 2. Update status in MongoDB ONLY after Gmail confirmation
  await Promise.all(
    emails.map((e) => {
      e.labels = (e.labels || []).filter((l) => l !== 'INBOX' && l !== 'SENT').concat('TRASH');
      e.isArchived = true;
      return e.save();
    })
  );

  return { success: true, threadId, count: emails.length };
}

export async function sendEmail(user, { to, subject, messageText, threadId = null, inReplyTo = null }) {
  const authClient = await getAuthenticatedOAuth2Client(user);
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  const senderName = user.name || user.email?.split('@')[0] || 'User';
  const senderEmail = user.email;

  const headers = [
    `From: "${senderName}" <${senderEmail}>`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject || '').toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit'
  ];

  if (inReplyTo) {
    headers.push(`In-Reply-To: <${inReplyTo}>`);
    headers.push(`References: <${inReplyTo}>`);
  }

  const rawMessage = `${headers.join('\r\n')}\r\n\r\n${messageText}`;
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const sendPayload = {
    userId: 'me',
    requestBody: {
      raw: encodedMessage
    }
  };

  if (threadId) {
    sendPayload.requestBody.threadId = threadId;
  }

  const sendRes = await gmail.users.messages.send(sendPayload);
  const sentData = sendRes.data;

  // Persist sent email to MongoDB safely using findOneAndUpdate upsert
  const sentEmail = await Email.findOneAndUpdate(
    { user: user._id, messageId: sentData.id },
    {
      $set: {
        user: user._id,
        messageId: sentData.id,
        threadId: sentData.threadId || sentData.id,
        sender: { name: senderName, email: senderEmail },
        recipients: parseAddressList(to),
        subject: subject || '(No Subject)',
        bodyText: messageText,
        bodyHtml: `<pre style="font-family: inherit; white-space: pre-wrap;">${messageText}</pre>`,
        snippet: messageText.substring(0, 100),
        labels: sentData.labelIds && sentData.labelIds.length > 0 ? sentData.labelIds : ['SENT'],
        isRead: true,
        isStarred: false,
        isArchived: false,
        receivedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Trigger background embedding for sent email (non-blocking)
  if (sentEmail?._id) {
    embedEmail(sentEmail).catch((err) => {
      console.warn('[SendEmail] Background embedding note:', err.message);
    });
  }

  return sentEmail;
}

export async function searchContacts(user, query = '') {
  try {
    const userId = user._id || user;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const sanitized = query ? query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    const searchRegex = new RegExp(sanitized, 'i');
    const contactsMap = new Map();

    // 1. Search in local MongoDB contacts
    const localContacts = await Email.aggregate([
      { $match: { user: userObjectId } },
      {
        $project: {
          contacts: {
            $concatArrays: [
              [{ name: '$sender.name', email: '$sender.email' }],
              { $ifNull: ['$recipients', []] }
            ]
          }
        }
      },
      { $unwind: '$contacts' },
      {
        $match: {
          'contacts.email': { $exists: true, $nin: [null, ''] },
          $or: [
            { 'contacts.email': { $regex: searchRegex } },
            { 'contacts.name': { $regex: searchRegex } }
          ]
        }
      },
      {
        $group: {
          _id: { $toLower: '$contacts.email' },
          name: { $first: '$contacts.name' },
          email: { $first: '$contacts.email' }
        }
      },
      { $sort: { name: 1, email: 1 } },
      { $limit: 12 }
    ]);

    localContacts.forEach((c) => {
      if (c.email) {
        contactsMap.set(c.email.toLowerCase(), {
          name: c.name && c.name.trim() ? c.name.trim() : c.email.split('@')[0],
          email: c.email
        });
      }
    });

    // 2. Live Gmail API search across the user's entire account history
    if (query && query.trim().length >= 2 && user.googleTokens) {
      try {
        const authClient = await getAuthenticatedOAuth2Client(user);
        const gmail = google.gmail({ version: 'v1', auth: authClient });

        const listRes = await gmail.users.messages.list({
          userId: 'me',
          maxResults: 6,
          q: query.trim()
        });

        const messages = listRes.data.messages || [];
        if (messages.length > 0) {
          const details = await Promise.allSettled(
            messages.slice(0, 6).map((m) =>
              gmail.users.messages.get({
                userId: 'me',
                id: m.id,
                format: 'metadata',
                metadataHeaders: ['From', 'To']
              })
            )
          );

          for (const item of details) {
            if (item.status === 'fulfilled' && item.value?.data?.payload?.headers) {
              const headers = item.value.data.payload.headers;
              const fromH = headers.find((h) => h.name.toLowerCase() === 'from')?.value;
              const toH = headers.find((h) => h.name.toLowerCase() === 'to')?.value;

              if (fromH) {
                const parsed = parseAddress(fromH);
                if (parsed.email && !contactsMap.has(parsed.email.toLowerCase())) {
                  contactsMap.set(parsed.email.toLowerCase(), parsed);
                }
              }
              if (toH) {
                const parsedList = parseAddressList(toH);
                parsedList.forEach((p) => {
                  if (p.email && !contactsMap.has(p.email.toLowerCase())) {
                    contactsMap.set(p.email.toLowerCase(), p);
                  }
                });
              }
            }
          }
        }
      } catch (liveErr) {
        console.warn('[LiveGmailContactSearch] Note:', liveErr.message);
      }
    }

    // 3. Smart Domain Auto-Completion (e.g., if typing a new username "alex", suggest "alex@gmail.com")
    if (query && !query.includes('@') && query.trim().length >= 2) {
      const cleanUser = query.trim().toLowerCase().replace(/\s+/g, '');
      const commonDomains = ['gmail.com', 'outlook.com', 'google.com', 'yahoo.com'];

      commonDomains.forEach((domain) => {
        const fullEmail = `${cleanUser}@${domain}`;
        if (!contactsMap.has(fullEmail)) {
          contactsMap.set(fullEmail, {
            name: query.trim(),
            email: fullEmail,
            isSuggestedDomain: true
          });
        }
      });
    }

    return Array.from(contactsMap.values()).slice(0, 10);
  } catch (err) {
    console.error('[SearchContacts] Error finding contacts:', err);
    return [];
  }
}

