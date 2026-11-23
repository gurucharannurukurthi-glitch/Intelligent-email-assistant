import { google } from 'googleapis';
import { getAuthenticatedOAuth2Client } from './googleAuthService.js';
import { Email } from '../models/Email.js';

/**
 * Creates an event on the user's primary Google Calendar after explicit user confirmation.
 * Includes server-side duplicate prevention and schema validation.
 *
 * @param {Object} user - User document from MongoDB
 * @param {Object} eventData - Validated event payload
 * @param {string} eventData.title - Event title / summary
 * @param {string} [eventData.description] - Description / notes
 * @param {string} [eventData.location] - Location or meeting link
 * @param {string} eventData.startDateTime - ISO 8601 string for event start
 * @param {string} [eventData.endDateTime] - ISO 8601 string for event end
 * @param {string} [eventData.timeZone] - IANA Timezone string (e.g. 'Asia/Kolkata')
 * @param {Array<string>} [eventData.attendees] - Array of attendee email addresses
 * @param {string} [eventData.emailId] - Optional email ID for duplicate tracking
 * @returns {Promise<Object>} Created calendar event details
 */
export async function createCalendarEvent(user, eventData) {
  if (!eventData || !eventData.title || !eventData.startDateTime) {
    const error = new Error('Missing required event fields: title and startDateTime are required');
    error.statusCode = 400;
    throw error;
  }

  // 1. Duplicate Protection: Check if this email already has an event created
  if (eventData.emailId) {
    const existingEmail = await Email.findOne({ _id: eventData.emailId, user: user._id });
    if (existingEmail && existingEmail.calendarEvent && existingEmail.calendarEvent.eventId) {
      return {
        success: true,
        alreadyExisted: true,
        eventId: existingEmail.calendarEvent.eventId,
        htmlLink: existingEmail.calendarEvent.htmlLink,
        summary: existingEmail.calendarEvent.summary,
        startDateTime: existingEmail.calendarEvent.startDateTime,
        endDateTime: existingEmail.calendarEvent.endDateTime,
        message: 'This event was already added to Google Calendar.'
      };
    }
  }

  // 2. Initialize authenticated Google Calendar client
  const authClient = await getAuthenticatedOAuth2Client(user);
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  // 3. Compute proper Start and End DateTimes
  const start = new Date(eventData.startDateTime);
  if (isNaN(start.getTime())) {
    const error = new Error('Invalid startDateTime format. Expected valid ISO date string.');
    error.statusCode = 400;
    throw error;
  }

  let end;
  if (eventData.endDateTime) {
    end = new Date(eventData.endDateTime);
    if (isNaN(end.getTime()) || end <= start) {
      // Default to 1 hour after start if invalid or before start
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
  } else {
    // Default 1 hour duration
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  const timeZone = eventData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // 4. Format attendees if provided
  const attendeesList = Array.isArray(eventData.attendees)
    ? eventData.attendees
        .filter((email) => email && typeof email === 'string' && email.includes('@'))
        .map((email) => ({ email: email.trim().toLowerCase() }))
    : [];

  const requestBody = {
    summary: eventData.title.trim(),
    description: (eventData.description || '').trim(),
    location: (eventData.location || '').trim(),
    start: {
      dateTime: start.toISOString(),
      timeZone
    },
    end: {
      dateTime: end.toISOString(),
      timeZone
    },
    attendees: attendeesList.length > 0 ? attendeesList : undefined
  };

  // 5. Call Google Calendar API
  let createdEvent;
  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody
    });
    createdEvent = response.data;
  } catch (apiErr) {
    console.error('[CalendarService] Google Calendar API error:', apiErr.message);

    // Check if Google Calendar API is disabled in Google Cloud Console
    if (apiErr.message && (apiErr.message.includes('has not been used') || apiErr.message.includes('disabled'))) {
      const disabledErr = new Error(
        'Google Calendar API is not enabled in your Google Cloud Console project. Please enable it in Google Cloud Console: APIs & Services > Enable APIs > Google Calendar API.'
      );
      disabledErr.statusCode = 400;
      disabledErr.isApiDisabled = true;
      throw disabledErr;
    }

    // Check for insufficient OAuth permissions / missing scopes
    if (
      apiErr.code === 403 ||
      apiErr.status === 403 ||
      (apiErr.message && apiErr.message.toLowerCase().includes('insufficient'))
    ) {
      const authErr = new Error(
        'Google Calendar permission required. Please reconnect your Google account to grant calendar permissions.'
      );
      authErr.statusCode = 403;
      authErr.requiresReauth = true;
      throw authErr;
    }

    const error = new Error(`Failed to create Google Calendar event: ${apiErr.message}`);
    error.statusCode = apiErr.code || 500;
    throw error;
  }

  // 6. Record event creation on the Email document for duplicate prevention
  if (eventData.emailId) {
    try {
      await Email.findOneAndUpdate(
        { _id: eventData.emailId, user: user._id },
        {
          $set: {
            calendarEvent: {
              eventId: createdEvent.id,
              htmlLink: createdEvent.htmlLink,
              summary: createdEvent.summary,
              startDateTime: start,
              endDateTime: end,
              createdAt: new Date()
            }
          }
        }
      );
    } catch (dbErr) {
      console.warn('[CalendarService] Failed to record calendar event on Email doc:', dbErr.message);
    }
  }

  return {
    success: true,
    alreadyExisted: false,
    eventId: createdEvent.id,
    htmlLink: createdEvent.htmlLink,
    summary: createdEvent.summary,
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    status: createdEvent.status
  };
}
