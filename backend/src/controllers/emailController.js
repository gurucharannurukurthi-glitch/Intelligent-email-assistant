import * as gmailService from '../services/gmailService.js';

export async function listEmails(req, res, next) {
  try {
    const { page, limit, folder, search } = req.query;
    const result = await gmailService.getEmails(req.user._id, { page, limit, folder, search });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getContacts(req, res, next) {
  try {
    const { q = '' } = req.query;
    const contacts = await gmailService.searchContacts(req.user, q);
    res.json({ success: true, contacts });
  } catch (error) {
    next(error);
  }
}

export async function syncInbox(req, res, next) {
  try {
    const maxResults = req.query.maxResults ? parseInt(req.query.maxResults, 10) : 40;
    const folder = req.query.folder || 'INBOX';
    const query = req.query.query || (folder === 'SENT' ? 'label:SENT' : 'label:INBOX');
    const synced = await gmailService.syncUserInbox(req.user, { maxResults, query });
    res.json({ success: true, count: synced.length, syncedEmails: synced });
  } catch (error) {
    next(error);
  }
}

export async function getThread(req, res, next) {
  try {
    const { threadId } = req.params;
    const thread = await gmailService.getThread(req.user, threadId);
    if (!thread || thread.length === 0) {
      return res.status(404).json({ error: 'NotFound', message: 'Thread not found' });
    }
    res.json({ threadId, emails: thread });
  } catch (error) {
    next(error);
  }
}

export async function updateEmail(req, res, next) {
  try {
    const { id } = req.params;
    const { isRead, isStarred, isArchived } = req.body;
    const updated = await gmailService.updateEmailState(req.user, id, {
      isRead,
      isStarred,
      isArchived
    });
    res.json({ success: true, email: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteEmail(req, res, next) {
  try {
    const { id } = req.params;
    const result = await gmailService.deleteEmail(req.user, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteThread(req, res, next) {
  try {
    const { threadId } = req.params;
    const result = await gmailService.deleteThread(req.user, threadId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function sendEmail(req, res, next) {
  try {
    const { to, subject, messageText, threadId, inReplyTo } = req.body;

    if (!to || !messageText) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Recipient (to) and message text are required.'
      });
    }

    const sent = await gmailService.sendEmail(req.user, {
      to,
      subject,
      messageText,
      threadId,
      inReplyTo
    });

    res.status(201).json({ success: true, email: sent });
  } catch (error) {
    next(error);
  }
}
