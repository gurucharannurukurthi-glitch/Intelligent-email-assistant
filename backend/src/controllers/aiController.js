import * as aiService from '../services/aiService.js';

export async function summarizeEmail(req, res, next) {
  try {
    const { emailId } = req.params;
    const result = await aiService.summarizeEmailOrThread(req.user._id, emailId);
    res.json({
      success: true,
      emailId,
      summary: result.summary,
      cached: result.cached
    });
  } catch (error) {
    next(error);
  }
}

export async function draftReply(req, res, next) {
  try {
    const { emailId } = req.params;
    const result = await aiService.generateReplyDraft(req.user._id, emailId);
    res.json({
      success: true,
      emailId,
      ...result
    });
  } catch (error) {
    next(error);
  }
}
