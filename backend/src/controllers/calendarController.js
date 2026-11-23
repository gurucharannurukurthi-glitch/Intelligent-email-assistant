import { extractMeetingProposal } from '../services/aiService.js';
import { createCalendarEvent } from '../services/calendarService.js';

/**
 * POST /api/calendar/detect/:threadId
 * Extracts structured meeting information from an email thread.
 */
export async function detectMeeting(req, res, next) {
  try {
    const { threadId } = req.params;
    if (!threadId) {
      return res.status(400).json({ success: false, message: 'threadId is required' });
    }

    const proposal = await extractMeetingProposal(req.user._id, threadId);
    return res.json({
      success: true,
      proposal
    });
  } catch (error) {
    console.error('[CalendarController] Detect meeting error:', error);
    next(error);
  }
}

/**
 * POST /api/calendar/events
 * Creates a Google Calendar event on the user's primary calendar after explicit user confirmation.
 */
export async function createEvent(req, res, next) {
  try {
    const {
      title,
      description,
      location,
      startDateTime,
      endDateTime,
      timeZone,
      attendees,
      emailId
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Event title is required.' });
    }

    if (!startDateTime) {
      return res.status(400).json({ success: false, message: 'Event start date/time is required.' });
    }

    const result = await createCalendarEvent(req.user, {
      title,
      description,
      location,
      startDateTime,
      endDateTime,
      timeZone,
      attendees,
      emailId
    });

    return res.status(result.alreadyExisted ? 200 : 201).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[CalendarController] Create event error:', error.message);

    if (error.isApiDisabled) {
      return res.status(400).json({
        success: false,
        isApiDisabled: true,
        message: error.message
      });
    }

    if (error.requiresReauth) {
      return res.status(403).json({
        success: false,
        requiresReauth: true,
        message: error.message
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
}
