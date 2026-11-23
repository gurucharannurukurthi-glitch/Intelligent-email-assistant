import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { Email } from '../models/Email.js';
import { getTasksForThread } from './taskService.js';

function getOpenAIClient() {
  const options = { apiKey: config.ai.openaiApiKey };
  if (config.ai.openaiBaseUrl) {
    options.baseURL = config.ai.openaiBaseUrl;
  }
  return new OpenAI(options);
}

function getAnthropicClient() {
  if (!config.ai.anthropicApiKey) {
    throw new Error('Anthropic API key is missing in environment variables');
  }
  return new Anthropic({ apiKey: config.ai.anthropicApiKey });
}

function getGeminiClient() {
  const key = config.ai.geminiApiKey || config.ai.openaiApiKey;
  if (!key) {
    throw new Error('Gemini API key is missing in environment variables');
  }
  return new GoogleGenAI({ apiKey: key });
}

async function callLLM({ systemPrompt, userPrompt }) {
  const provider = config.ai.provider.toLowerCase();

  // 1. Google Gemini Provider
  if (provider === 'gemini' || config.ai.geminiApiKey) {
    const ai = getGeminiClient();
    const prompt = `${systemPrompt}\n\n${userPrompt}`;
    const candidateModels = ['gemini-2.5-flash', 'gemini-3.6-flash'];

    for (const targetModel of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: targetModel,
          contents: prompt
        });
        return response.text || '';
      } catch (geminiErr) {
        console.warn(`[AI Service] Gemini ${targetModel} call failed:`, geminiErr.message?.substring(0, 100));
      }
    }

      // If OpenAI key is present, fallback gracefully to OpenAI
    if (config.ai.openaiApiKey) {
      console.log('[AI Service] Falling back to OpenAI (gpt-4o-mini)...');
      try {
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });
        return response.choices[0]?.message?.content || '';
      } catch (openAiErr) {
        console.error('[AI Service] OpenAI fallback also failed:', openAiErr.message);
      }
    }
    throw new Error('All Gemini models failed and no OpenAI fallback available');
  }

  // 2. Anthropic Provider
  if (provider === 'anthropic' && config.ai.anthropicApiKey) {
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: config.ai.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    return response.content[0]?.text || '';
  }

  // 3. OpenAI / GPT Provider
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: config.ai.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 1000
  });

  return response.choices[0]?.message?.content || '';
}

export async function summarizeEmailOrThread(userId, emailId) {
  const email = await Email.findOne({ user: userId, _id: emailId });
  if (!email) {
    throw new Error('Email not found');
  }

  // Return cached summary if already generated
  if (email.aiSummary) {
    return { summary: email.aiSummary, cached: true };
  }

  // Retrieve full thread messages to synthesize long threads
  const threadEmails = await Email.find({ user: userId, threadId: email.threadId })
    .sort({ receivedAt: 1 })
    .lean();

  let contextContent = '';

  if (threadEmails.length > 1) {
    contextContent = threadEmails
      .map((msg, index) => {
        const sender = msg.sender?.name || msg.sender?.email || 'Unknown';
        const date = msg.receivedAt ? new Date(msg.receivedAt).toLocaleString() : '';
        const bodySnippet = msg.bodyText ? msg.bodyText.substring(0, 1500) : msg.snippet || '';
        return `Message ${index + 1} from ${sender} (${date}):\n${bodySnippet}`;
      })
      .join('\n\n---\n\n');
  } else {
    contextContent = `Subject: ${email.subject}\nFrom: ${email.sender?.name || ''} <${email.sender?.email || ''}>\nBody:\n${email.bodyText || email.snippet || ''}`;
  }

  const systemPrompt = `You are an intelligent email assistant. Provide a concise, clear, high-signal executive summary of the following email or email thread.
Highlight:
1. Core purpose / topic
2. Key points or decisions made
3. Any explicit next steps, action items, or questions asked.
Keep the summary structured, professional, and easy to read.`;

  const summary = await callLLM({
    systemPrompt,
    userPrompt: contextContent
  });

  // Cache on the email document
  email.aiSummary = summary;
  await email.save();

  return { summary, cached: false };
}

export async function generateReplyDraft(userId, emailId) {
  const email = await Email.findOne({ user: userId, _id: emailId });
  if (!email) {
    throw new Error('Email not found');
  }

  // Fetch thread messages to ensure full conversational context
  const threadEmails = await Email.find({ user: userId, threadId: email.threadId })
    .sort({ receivedAt: 1 })
    .lean();

  let conversationContext = '';
  if (threadEmails.length > 1) {
    conversationContext = threadEmails
      .map((msg, index) => {
        const sender = msg.sender?.name || msg.sender?.email || 'Unknown';
        const body = msg.bodyText ? msg.bodyText.substring(0, 1200) : msg.snippet || '';
        return `[Message ${index + 1} from ${sender}]:\n${body}`;
      })
      .join('\n\n');
  } else {
    conversationContext = `Subject: ${email.subject}\nFrom: ${email.sender?.name || ''} <${email.sender?.email || ''}>\nBody:\n${email.bodyText || email.snippet || ''}`;
  }

  const systemPrompt = `You are an expert AI email assistant. Draft a helpful, context-aware, professional email reply to the incoming email / thread.
Rules:
- Directly address any questions or topics brought up in the thread.
- Maintain a polite, natural, and clear communication style.
- Output ONLY the plain text of the email reply draft (no placeholder brackets like [Your Name] if possible, or use the recipient's name naturally).
- Do not wrap in quotes or add conversational preamble.`;

  const userPrompt = `Please draft a reply to this email thread:\n\n${conversationContext}`;

  const draft = await callLLM({
    systemPrompt,
    userPrompt
  });

  // Calculate default subject and recipient for reply
  const replySubject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;
  const replyTo = email.sender?.email || '';

  return {
    draftText: draft.trim(),
    replySubject,
    replyTo,
    threadId: email.threadId,
    messageId: email.messageId
  };
}

/**
 * Analyzes an email thread to detect meeting/event proposals and extracts structured calendar metadata.
 * Resolves relative dates ("tomorrow", "this Friday") against the email's received timestamp.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {string} threadId - Thread ID or Email ID
 * @returns {Promise<Object>} Structured event proposal
 */
export async function extractMeetingProposal(userId, threadId) {
  // 1. Fetch thread emails sorted by date
  let threadEmails = await Email.find({ user: userId, threadId })
    .sort({ receivedAt: 1 })
    .lean();

  if (!threadEmails || threadEmails.length === 0) {
    const singleEmail = await Email.findOne({ user: userId, _id: threadId }).lean();
    if (singleEmail) {
      threadEmails = [singleEmail];
    } else {
      throw new Error('Email thread not found');
    }
  }

  const latestEmail = threadEmails[threadEmails.length - 1];

  // 2. Check if a calendar event has already been recorded for this thread/email
  const existingEventEmail = threadEmails.find((e) => e.calendarEvent && e.calendarEvent.eventId);
  if (existingEventEmail) {
    return {
      isMeetingDetected: true,
      alreadyCreated: true,
      existingEvent: {
        eventId: existingEventEmail.calendarEvent.eventId,
        htmlLink: existingEventEmail.calendarEvent.htmlLink,
        summary: existingEventEmail.calendarEvent.summary,
        startDateTime: existingEventEmail.calendarEvent.startDateTime,
        endDateTime: existingEventEmail.calendarEvent.endDateTime
      }
    };
  }

  // 3. Format email context for LLM extraction
  const refDate = latestEmail.receivedAt ? new Date(latestEmail.receivedAt) : new Date();
  const refDateStr = refDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const refDayName = refDate.toLocaleDateString('en-US', { weekday: 'long' });

  const conversationText = threadEmails
    .map((msg, idx) => {
      const sender = msg.sender?.name ? `${msg.sender.name} <${msg.sender.email}>` : msg.sender?.email || 'Unknown';
      const sentTime = msg.receivedAt ? new Date(msg.receivedAt).toISOString() : '';
      const body = msg.bodyText ? msg.bodyText.slice(0, 1500) : msg.snippet || '';
      return `--- Message ${idx + 1} (From: ${sender} | Date: ${sentTime}) ---\nSubject: ${msg.subject}\nBody:\n${body}`;
    })
    .join('\n\n');

  // Collect potential attendee emails
  const candidateAttendees = new Set();
  threadEmails.forEach((e) => {
    if (e.sender?.email) candidateAttendees.add(e.sender.email.toLowerCase());
    if (Array.isArray(e.recipients)) {
      e.recipients.forEach((r) => {
        if (r.email) candidateAttendees.add(r.email.toLowerCase());
      });
    }
  });

  const systemPrompt = `You are a precision Calendar Event Extraction AI assistant.
Your task is to analyze the email thread and determine whether a meeting, call, sync, review, presentation, or appointment is being scheduled, proposed, or discussed.

Reference Email Date: ${refDateStr} (${refDayName})

CRITICAL RULES:
1. Determine if a calendar meeting or appointment is present or requested. If NOT, return {"isMeetingDetected": false}.
2. Resolve relative dates ("tomorrow", "this Friday", "next Monday", "Sep 7") relative to the Reference Email Date (${refDateStr}).
3. For times, extract in 24-hour HH:MM format (e.g. "16:00" for 4:00 PM).
4. If a date or time is ambiguous or missing (e.g., "Let's catch up sometime next week"), set date or startTime to null and set confidence to "low". DO NOT INVENT fake dates or times.
5. Extract meetingLink (Zoom, Google Meet, Microsoft Teams URL) if explicitly present in the email body, else null.
6. Extract location (physical address, room number, or office) if mentioned, else null.
7. Return strictly a single valid JSON object with no preamble or markdown wrapping.

REQUIRED JSON FORMAT:
{
  "isMeetingDetected": true,
  "confidence": "high" | "medium" | "low",
  "title": "Clean concise meeting title",
  "date": "YYYY-MM-DD" | null,
  "startTime": "HH:MM" | null,
  "endTime": "HH:MM" | null,
  "startDateTime": "YYYY-MM-DDTHH:MM:00" | null,
  "endDateTime": "YYYY-MM-DDTHH:MM:00" | null,
  "location": "Physical location or null",
  "meetingLink": "URL or null",
  "description": "Brief 1-2 sentence context of the meeting",
  "attendees": ["email@example.com"],
  "notes": "Any missing details or null"
}`;

  const userPrompt = `Analyze this email thread for calendar event details:\n\n${conversationText}`;

  const rawOutput = await callLLM({
    systemPrompt,
    userPrompt
  });

  // 4. Parse output safely
  let parsed;
  try {
    const cleaned = rawOutput
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.warn('[AI Service] Failed to parse meeting extraction JSON:', err.message, rawOutput);
    return {
      isMeetingDetected: false,
      error: 'Failed to parse meeting details from AI response'
    };
  }

  if (!parsed || !parsed.isMeetingDetected) {
    return { isMeetingDetected: false };
  }

  // 5. Post-process and sanitize dates/times
  let startDateTime = parsed.startDateTime || null;
  let endDateTime = parsed.endDateTime || null;

  if (parsed.date && parsed.startTime) {
    const combinedStart = `${parsed.date}T${parsed.startTime}:00`;
    startDateTime = combinedStart;

    if (parsed.endTime) {
      endDateTime = `${parsed.date}T${parsed.endTime}:00`;
    } else {
      // Default 1 hour duration
      const s = new Date(combinedStart);
      if (!isNaN(s.getTime())) {
        const e = new Date(s.getTime() + 60 * 60 * 1000);
        endDateTime = e.toISOString().slice(0, 19);
      }
    }
  }

  return {
    isMeetingDetected: true,
    confidence: parsed.confidence || 'medium',
    title: parsed.title || latestEmail.subject || 'Meeting',
    date: parsed.date || null,
    startTime: parsed.startTime || null,
    endTime: parsed.endTime || null,
    startDateTime,
    endDateTime,
    location: parsed.location || null,
    meetingLink: parsed.meetingLink || null,
    description: parsed.description || '',
    attendees: Array.isArray(parsed.attendees) && parsed.attendees.length > 0
      ? parsed.attendees
      : Array.from(candidateAttendees).slice(0, 5),
    emailId: latestEmail._id,
    threadId: latestEmail.threadId,
    notes: parsed.notes || null
  };
}

/**
 * Analyzes an email thread to detect actionable requests/tasks directed to or needed by the user.
 * Strictly separates tasks from meeting requests and informational messages.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {string} threadId - Thread ID or Email ID
 * @returns {Promise<Object>} Detected tasks payload with duplicate detection status
 */
export async function extractTaskProposals(userId, threadId) {
  // 1. Fetch thread emails sorted by date
  let threadEmails = await Email.find({ user: userId, threadId })
    .sort({ receivedAt: 1 })
    .lean();

  if (!threadEmails || threadEmails.length === 0) {
    const singleEmail = await Email.findOne({ user: userId, _id: threadId }).lean();
    if (singleEmail) {
      threadEmails = [singleEmail];
    } else {
      throw new Error('Email thread not found');
    }
  }

  const latestEmail = threadEmails[threadEmails.length - 1];

  // 2. Fetch existing tasks for this thread to cross-reference duplicates
  let existingTasks = [];
  try {
    existingTasks = await getTasksForThread(userId, latestEmail.threadId);
  } catch (err) {
    console.warn('[AI Service] Could not fetch existing tasks for thread:', err.message);
  }

  // 3. Format email context
  const refDate = latestEmail.receivedAt ? new Date(latestEmail.receivedAt) : new Date();
  const refDateStr = refDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const refDayName = refDate.toLocaleDateString('en-US', { weekday: 'long' });

  const conversationText = threadEmails
    .map((msg, idx) => {
      const sender = msg.sender?.name ? `${msg.sender.name} <${msg.sender.email}>` : msg.sender?.email || 'Unknown';
      const sentTime = msg.receivedAt ? new Date(msg.receivedAt).toISOString() : '';
      const body = msg.bodyText ? msg.bodyText.slice(0, 1500) : msg.snippet || '';
      return `--- Message ${idx + 1} (From: ${sender} | Date: ${sentTime}) ---\nSubject: ${msg.subject}\nBody:\n${body}`;
    })
    .join('\n\n');

  const systemPrompt = `You are a precision Email Action & Task Extraction AI assistant.
Your task is to analyze the email thread and determine whether there are explicit or strongly implied ACTIONABLE REQUESTS, TASKS, DELIVERABLES, or TO-DOS requested from or needed by the recipient.

Reference Email Date: ${refDateStr} (${refDayName})

CRITICAL RULES:
1. Identify genuine actionable work items (e.g., "Please submit the report by September 5", "Review the proposal", "Send the deployment link", "Complete API documentation").
2. DO NOT create tasks for meeting schedules or calendar invites (e.g., "The project meeting is scheduled for Friday at 4 PM" is a Calendar event, NOT a task).
3. DO NOT create tasks for purely informational emails, receipts, or newsletters without work requests (e.g. "The invoice amount is ₹48,500" is NOT a task).
4. If an email contains multiple distinct actionable requests (e.g. "Submit report by Friday and send deployment link"), extract them as separate individual tasks.
5. Resolve relative deadlines ("by Friday", "by tomorrow", "before Monday") relative to Reference Email Date (${refDateStr}) in YYYY-MM-DD format.
6. If NO deadline is specified (e.g., "Please review the documentation"), set dueDate to null. DO NOT INVENT fake deadlines.
7. If deadline is ambiguous (e.g., "sometime next week"), set dueDate to null and set confidence to "low".
8. Return strictly a single valid JSON object with no markdown wrapping.

REQUIRED JSON FORMAT:
{
  "hasTasks": true | false,
  "tasks": [
    {
      "title": "Clean concise action title (e.g., Submit final project report)",
      "description": "Any additional context or instructions, or empty string",
      "dueDate": "YYYY-MM-DD" | null,
      "confidence": "high" | "medium" | "low"
    }
  ]
}`;

  const userPrompt = `Analyze this email thread for actionable tasks:\n\n${conversationText}`;

  const rawOutput = await callLLM({
    systemPrompt,
    userPrompt
  });

  // 4. Parse output safely
  let parsed;
  try {
    const cleaned = rawOutput
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.warn('[AI Service] Failed to parse task extraction JSON:', err.message, rawOutput);
    return {
      hasTasks: false,
      tasks: []
    };
  }

  if (!parsed || !parsed.hasTasks || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
    return {
      hasTasks: false,
      tasks: []
    };
  }

  // 5. Cross-reference with existing created tasks for duplicate detection
  const enrichedTasks = parsed.tasks.map((taskItem) => {
    const cleanTitle = (taskItem.title || '').trim();
    const existingMatch = existingTasks.find(
      (et) => et.title.toLowerCase() === cleanTitle.toLowerCase()
    );

    return {
      title: cleanTitle,
      description: (taskItem.description || '').trim(),
      dueDate: taskItem.dueDate || null,
      confidence: taskItem.confidence || 'medium',
      alreadyCreated: Boolean(existingMatch),
      existingTaskId: existingMatch ? existingMatch._id : null,
      existingStatus: existingMatch ? existingMatch.status : null,
      sourceEmailId: latestEmail._id,
      sourceThreadId: latestEmail.threadId,
      sourceSubject: latestEmail.subject || '(No Subject)',
      sourceSender: latestEmail.sender || { name: '', email: '' }
    };
  });

  return {
    hasTasks: enrichedTasks.length > 0,
    tasks: enrichedTasks,
    sourceEmailId: latestEmail._id,
    sourceThreadId: latestEmail.threadId,
    sourceSubject: latestEmail.subject || '(No Subject)',
    sourceSender: latestEmail.sender || { name: '', email: '' }
  };
}

/**
 * Evaluates whether an outbound sent email was requesting a response/action or was purely informational/closed.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {Object} email - Email document
 * @returns {Promise<Object>} Evaluation result { needsResponse, confidence, reason }
 */
export async function evaluateFollowUpNeed(userId, email) {
  const body = (email.bodyText || email.snippet || '').slice(0, 2000);
  const subject = email.subject || '';
  const recipientName = email.recipients?.[0]?.name || email.recipients?.[0]?.email || 'recipient';

  const systemPrompt = `You are a precision Email Follow-up Classification AI.
Your task is to analyze an OUTBOUND email sent by the user to ${recipientName} and determine if it explicitly or strongly expects/requires a response, review, deliverable, decision, or update.

CRITICAL RULES:
1. Return needsResponse: true ONLY if the user asked a question, requested a document/review/feedback, or asked the recipient to take an action.
2. Return needsResponse: false for:
   - "Thank you" notes or pleasantries ("Thanks for your help!", "Great catching up").
   - Informational updates, receipts, or invoices without a direct question ("Here is the invoice for your records", "Here are the meeting notes").
   - Confirmations ("Meeting confirmed for Monday").
   - Sign-offs or concluding messages.
3. If ambiguous or low clarity, set confidence: "low" or needsResponse: false.
4. Provide a concise, clear 1-sentence reason explaining why a follow-up is appropriate (e.g. "You asked Rahul to review the project proposal and provide feedback.").
5. Return strictly a single valid JSON object.

REQUIRED JSON FORMAT:
{
  "needsResponse": true | false,
  "confidence": "high" | "medium" | "low",
  "reason": "Clear concise 1-sentence explanation or empty string"
}`;

  const userPrompt = `Subject: ${subject}\nBody:\n${body}`;

  try {
    const rawOutput = await callLLM({ systemPrompt, userPrompt });
    const cleaned = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      needsResponse: Boolean(parsed.needsResponse && parsed.confidence !== 'low'),
      confidence: parsed.confidence || 'medium',
      reason: parsed.reason || ''
    };
  } catch (err) {
    console.warn('[AI Service] Failed to evaluate follow-up need:', err.message);
    return {
      needsResponse: false,
      confidence: 'low',
      reason: ''
    };
  }
}

/**
 * Generates a context-aware, polite, and concise follow-up email draft.
 *
 * @param {string|mongoose.Types.ObjectId} userId - User ID
 * @param {string} threadId - Thread ID
 * @param {Object} originalEmail - The original sent email document
 * @returns {Promise<string>} Generated follow-up text draft
 */
export async function generateFollowUpDraft(userId, threadId, originalEmail) {
  const recipientName = originalEmail.recipients?.[0]?.name || originalEmail.recipients?.[0]?.email?.split('@')[0] || 'there';
  const originalSubject = originalEmail.subject || '';
  const originalBody = (originalEmail.bodyText || originalEmail.snippet || '').slice(0, 1500);

  const systemPrompt = `You are an expert AI email assistant. Draft a polite, concise, and professional follow-up email.
Rules:
- Directly reference the topic and request from the original email.
- Keep it brief (2 to 4 sentences).
- Maintain a courteous, warm, and natural professional tone.
- Do NOT sound pushy, aggressive, or passive-aggressive.
- Do NOT say "since you ignored my last email" or invent fake deadlines.
- Output ONLY the plain text of the follow-up draft (no greetings like [Your Name] if possible, or use standard signoff).
- Do NOT wrap in quotes or markdown code blocks.`;

  const userPrompt = `Original Email to ${recipientName}:
Subject: ${originalSubject}
Body:
${originalBody}

Draft a follow-up email message:`;

  const rawDraft = await callLLM({ systemPrompt, userPrompt });
  return rawDraft.trim();
}

