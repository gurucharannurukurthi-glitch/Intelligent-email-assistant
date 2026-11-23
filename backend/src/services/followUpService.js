import mongoose from 'mongoose';
import { FollowUp } from '../models/FollowUp.js';
import { Email } from '../models/Email.js';
import { User } from '../models/User.js';
import { evaluateFollowUpNeed, generateFollowUpDraft } from './aiService.js';
import { sendEmail } from './gmailService.js';

// Configurable constants for follow-up eligibility window
export const DEFAULT_MIN_WAITING_DAYS = 3;  // Minimum days before suggesting follow-up
export const DEFAULT_MAX_WAITING_DAYS = 30; // Maximum age window to avoid historical/ancient emails

/**
 * Scans the user's sent emails and evaluates unanswered requests against the actionable window.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {Object} [options] - Options
 * @param {number} [options.minWaitingDays=3] - Minimum waiting period in days
 * @param {number} [options.maxWaitingDays=30] - Maximum age cutoff in days
 * @returns {Promise<Array<Object>>} List of active follow-up suggestions within the actionable window
 */
export async function evaluateFollowUpsForUser(userId, options = {}) {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const userEmail = (user.email || '').toLowerCase();
  const minWaitingDays =
    options.minWaitingDays !== undefined
      ? Number(options.minWaitingDays)
      : options.waitingDays !== undefined
      ? Number(options.waitingDays)
      : DEFAULT_MIN_WAITING_DAYS;

  const maxWaitingDays =
    options.maxWaitingDays !== undefined
      ? Number(options.maxWaitingDays)
      : DEFAULT_MAX_WAITING_DAYS;

  const now = new Date();
  const minDate = new Date(now.getTime() - maxWaitingDays * 24 * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() - minWaitingDays * 24 * 60 * 60 * 1000);

  // 1. Fetch sent emails within the actionable age window [minDate, maxDate]
  // This completely eliminates scanning ancient emails from 100+ or 1000+ days ago!
  const sentEmails = await Email.find({
    user: userId,
    $or: [{ labels: 'SENT' }, { 'sender.email': userEmail }],
    receivedAt: { $gte: minDate, $lte: maxDate }
  })
    .sort({ receivedAt: -1 })
    .limit(30)
    .lean();

  if (!sentEmails || sentEmails.length === 0) {
    // Return only active suggestions within the actionable window
    return FollowUp.find({
      user: userId,
      status: 'suggested',
      sentAt: { $gte: minDate, $lte: maxDate }
    })
      .sort({ sentAt: -1 })
      .lean();
  }

  // Deduplicate by threadId to evaluate the latest sent message per thread
  const seenThreads = new Set();
  const candidateSentEmails = [];

  for (const email of sentEmails) {
    if (!seenThreads.has(email.threadId)) {
      seenThreads.add(email.threadId);
      candidateSentEmails.push(email);
    }
  }

  // 2. Evaluate each candidate thread
  for (const sentEmail of candidateSentEmails) {
    const threadId = sentEmail.threadId;

    // Fetch full thread in chronological order
    const threadEmails = await Email.find({ user: userId, threadId })
      .sort({ receivedAt: 1 })
      .lean();

    if (!threadEmails || threadEmails.length === 0) continue;

    // Find the latest message in this thread that was sent by the user
    const outboundMessages = threadEmails.filter(
      (m) =>
        (m.labels && m.labels.includes('SENT')) ||
        (m.sender?.email && m.sender.email.toLowerCase() === userEmail)
    );

    if (outboundMessages.length === 0) continue;
    const latestSent = outboundMessages[outboundMessages.length - 1];

    // Check if there is ANY recipient message received AFTER the latest sent message
    const subsequentResponses = threadEmails.filter(
      (m) =>
        new Date(m.receivedAt) > new Date(latestSent.receivedAt) &&
        m.sender?.email &&
        m.sender.email.toLowerCase() !== userEmail
    );

    // If recipient responded, the thread is answered -> No follow-up needed
    if (subsequentResponses.length > 0) {
      continue;
    }

    // Check elapsed waiting time
    const sentTime = new Date(latestSent.receivedAt).getTime();
    const elapsedDays = (now.getTime() - sentTime) / (1000 * 60 * 60 * 24);

    // Enforce both minimum waiting period AND maximum age window
    if (elapsedDays < minWaitingDays || elapsedDays > maxWaitingDays) {
      continue;
    }

    // 3. Check existing FollowUp records for duplicate prevention
    const existingFollowUp = await FollowUp.findOne({
      user: userId,
      threadId,
      sourceEmailId: latestSent._id
    });

    if (existingFollowUp) {
      if (existingFollowUp.status === 'dismissed' || existingFollowUp.status === 'sent') {
        // User already handled or dismissed this follow-up
        continue;
      }
      // Update waiting days on active suggestion
      existingFollowUp.waitingDays = Math.floor(elapsedDays);
      await existingFollowUp.save();
      continue;
    }

    // 4. Run precision AI classification to verify if a response was genuinely expected
    const aiResult = await evaluateFollowUpNeed(userId, latestSent);

    if (aiResult.needsResponse) {
      const recipient =
        latestSent.recipients && latestSent.recipients.length > 0
          ? latestSent.recipients[0]
          : { name: '', email: 'recipient@example.com' };

      await FollowUp.create({
        user: userId,
        threadId,
        sourceEmailId: latestSent._id,
        recipient: {
          name: recipient.name || '',
          email: recipient.email || ''
        },
        subject: latestSent.subject || '(No Subject)',
        reason: aiResult.reason || 'No response detected for your sent request.',
        sentAt: latestSent.receivedAt,
        waitingDays: Math.floor(elapsedDays),
        status: 'suggested'
      });
    }
  }

  // Return active suggestions within the actionable window
  return FollowUp.find({
    user: userId,
    status: 'suggested',
    sentAt: { $gte: minDate, $lte: maxDate }
  })
    .sort({ sentAt: -1 })
    .lean();
}

/**
 * Retrieves current active follow-up suggestions within the actionable window.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {Object} [options] - Options
 * @param {number} [options.maxWaitingDays=30] - Maximum age cutoff in days
 * @returns {Promise<Array<Object>>} List of suggested follow-ups
 */
export async function getFollowUpSuggestions(userId, options = {}) {
  const maxWaitingDays =
    options.maxWaitingDays !== undefined
      ? Number(options.maxWaitingDays)
      : DEFAULT_MAX_WAITING_DAYS;

  const minDate = new Date(Date.now() - maxWaitingDays * 24 * 60 * 60 * 1000);

  return FollowUp.find({
    user: userId,
    status: 'suggested',
    sentAt: { $gte: minDate }
  })
    .sort({ sentAt: -1 })
    .lean();
}

/**
 * Generates an AI follow-up draft for a suggestion.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {string} followUpId - FollowUp ID
 * @returns {Promise<Object>} Generated draft metadata
 */
export async function createFollowUpDraft(userId, followUpId) {
  const followUp = await FollowUp.findOne({ _id: followUpId, user: userId });
  if (!followUp) {
    const error = new Error('Follow-up suggestion not found');
    error.statusCode = 404;
    throw error;
  }

  const originalEmail = await Email.findOne({ _id: followUp.sourceEmailId, user: userId }).lean();
  if (!originalEmail) {
    const error = new Error('Original email not found');
    error.statusCode = 404;
    throw error;
  }

  const draftText = await generateFollowUpDraft(userId, followUp.threadId, originalEmail);
  followUp.draftText = draftText;
  await followUp.save();

  const replySubject = originalEmail.subject?.startsWith('Re:')
    ? originalEmail.subject
    : `Re: ${originalEmail.subject || '(No Subject)'}`;

  return {
    followUpId: followUp._id,
    to: followUp.recipient.email,
    recipientName: followUp.recipient.name,
    subject: replySubject,
    draftText,
    threadId: followUp.threadId
  };
}

/**
 * Sends a reviewed & confirmed follow-up email via Gmail API and updates FollowUp status.
 *
 * @param {Object} user - User document
 * @param {string} followUpId - FollowUp ID
 * @param {Object} sendPayload - { messageText, subject }
 * @returns {Promise<Object>} Send confirmation
 */
export async function sendFollowUp(user, followUpId, sendPayload = {}) {
  const followUp = await FollowUp.findOne({ _id: followUpId, user: user._id });
  if (!followUp) {
    const error = new Error('Follow-up suggestion not found');
    error.statusCode = 404;
    throw error;
  }

  const originalEmail = await Email.findOne({ _id: followUp.sourceEmailId, user: user._id }).lean();

  const to = followUp.recipient.email;
  const subject =
    sendPayload.subject ||
    (originalEmail?.subject?.startsWith('Re:')
      ? originalEmail.subject
      : `Re: ${originalEmail?.subject || followUp.subject}`);
  const messageText = sendPayload.messageText || followUp.draftText;

  if (!messageText || !messageText.trim()) {
    const error = new Error('Email message text cannot be empty.');
    error.statusCode = 400;
    throw error;
  }

  // Send email through existing secure Gmail API infrastructure
  const sendResult = await sendEmail(user, {
    to,
    subject,
    messageText: messageText.trim(),
    threadId: followUp.threadId,
    inReplyTo: originalEmail?.messageId || null
  });

  // Mark FollowUp as sent
  followUp.status = 'sent';
  followUp.followUpSentAt = new Date();
  followUp.draftText = messageText.trim();
  await followUp.save();

  return {
    success: true,
    message: 'Follow-up email sent successfully.',
    sendResult,
    followUp: followUp.toObject()
  };
}

/**
 * Dismisses a follow-up suggestion.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {string} followUpId - FollowUp ID
 * @returns {Promise<Object>} Updated followUp
 */
export async function dismissFollowUp(userId, followUpId) {
  const followUp = await FollowUp.findOne({ _id: followUpId, user: userId });
  if (!followUp) {
    const error = new Error('Follow-up suggestion not found');
    error.statusCode = 404;
    throw error;
  }

  followUp.status = 'dismissed';
  followUp.dismissedAt = new Date();
  await followUp.save();

  return followUp.toObject();
}
