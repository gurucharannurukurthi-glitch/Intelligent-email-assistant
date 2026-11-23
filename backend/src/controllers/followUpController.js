import {
  evaluateFollowUpsForUser,
  getFollowUpSuggestions,
  createFollowUpDraft,
  sendFollowUp,
  dismissFollowUp
} from '../services/followUpService.js';

/**
 * GET /api/follow-ups
 * Evaluates and returns active follow-up suggestions for the authenticated user.
 */
export async function getFollowUps(req, res, next) {
  try {
    const { minWaitingDays, maxWaitingDays, waitingDays } = req.query;
    const followUps = await evaluateFollowUpsForUser(req.user._id, {
      minWaitingDays,
      maxWaitingDays,
      waitingDays
    });
    return res.json({
      success: true,
      followUps
    });
  } catch (error) {
    console.error('[FollowUpController] Get follow-ups error:', error);
    next(error);
  }
}

/**
 * POST /api/follow-ups/evaluate
 * Explicitly triggers evaluation of unanswered sent emails.
 */
export async function evaluateFollowUpsHandler(req, res, next) {
  try {
    const { minWaitingDays, maxWaitingDays, waitingDays } = req.body;
    const followUps = await evaluateFollowUpsForUser(req.user._id, {
      minWaitingDays,
      maxWaitingDays,
      waitingDays
    });
    return res.json({
      success: true,
      followUps
    });
  } catch (error) {
    console.error('[FollowUpController] Evaluate follow-ups error:', error);
    next(error);
  }
}

/**
 * POST /api/follow-ups/:id/draft
 * Generates an AI follow-up draft.
 */
export async function generateDraftHandler(req, res, next) {
  try {
    const { id } = req.params;
    const draft = await createFollowUpDraft(req.user._id, id);
    return res.json({
      success: true,
      draft
    });
  } catch (error) {
    console.error('[FollowUpController] Generate draft error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/**
 * POST /api/follow-ups/:id/send
 * Sends the user's edited follow-up email via Gmail API.
 */
export async function sendFollowUpHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { messageText, subject } = req.body;

    const result = await sendFollowUp(req.user, id, { messageText, subject });
    return res.json(result);
  } catch (error) {
    console.error('[FollowUpController] Send follow-up error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
}

/**
 * POST /api/follow-ups/:id/dismiss
 * Dismisses a follow-up suggestion.
 */
export async function dismissFollowUpHandler(req, res, next) {
  try {
    const { id } = req.params;
    const followUp = await dismissFollowUp(req.user._id, id);
    return res.json({
      success: true,
      followUp
    });
  } catch (error) {
    console.error('[FollowUpController] Dismiss follow-up error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
}
