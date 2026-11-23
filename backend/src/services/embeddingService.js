import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { Email } from '../models/Email.js';

let genAIClient = null;
const activeBatchLocks = new Set();
let quotaCooldownUntil = 0;

function getGenAIClient() {
  if (!genAIClient) {
    const apiKey = config.ai.geminiApiKey || config.ai.openaiApiKey;
    if (!apiKey) {
      throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in backend/.env');
    }
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

/**
 * Builds a clean, deterministic plaintext representation of an email for embedding.
 * Format:
 * Subject: <subject>
 * From: <name> <email>
 * Content: <sanitized plaintext body>
 *
 * @param {Object} email - Email document or object
 * @returns {string} Sanitized plaintext
 */
export function buildEmailEmbeddingText(email) {
  const subject = (email.subject || '(No Subject)').trim();
  const senderName = email.sender?.name?.trim() || '';
  const senderEmail = email.sender?.email?.trim() || '';
  const senderStr = senderName ? `${senderName} <${senderEmail}>` : senderEmail || 'Unknown';

  // Sanitize body: remove HTML tags, excessive whitespace, limit to 2,000 chars
  const rawBody = email.bodyText || email.snippet || '';
  const cleanBody = rawBody
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);

  return `Subject: ${subject}\nFrom: ${senderStr}\nContent:\n${cleanBody}`;
}

/**
 * Generates a vector embedding for a single piece of text using Gemini gemini-embedding-001.
 *
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Float vector of length 768
 */
export async function generateTextEmbedding(text) {
  if (!text || !text.trim()) {
    throw new Error('Cannot generate embedding for empty text');
  }

  // Check if we are currently in an active quota cooldown window
  const now = Date.now();
  if (now < quotaCooldownUntil) {
    const secondsRemaining = Math.ceil((quotaCooldownUntil - now) / 1000);
    const err = new Error(
      `Gemini embedding quota is currently cooling down (${secondsRemaining}s remaining). Please wait before retrying.`
    );
    err.status = 429;
    err.isQuotaError = true;
    throw err;
  }

  const ai = getGenAIClient();
  const modelName = config.ai.embeddingModel || 'gemini-embedding-001';
  const targetDim = config.ai.embeddingDimension || 768;

  try {
    const response = await ai.models.embedContent({
      model: modelName,
      contents: text.trim(),
      config: {
        outputDimensionality: targetDim
      }
    });

    const embeddingObj = response.embeddings && response.embeddings[0];
    if (!embeddingObj || !Array.isArray(embeddingObj.values) || embeddingObj.values.length === 0) {
      throw new Error('Gemini embedding API returned an invalid response structure');
    }

    return embeddingObj.values;
  } catch (err) {
    const errMsg = err.message || '';
    if (
      errMsg.includes('429') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('quota') ||
      err.status === 429
    ) {
      // Set a 45-second cooldown to protect the API key from continuous failure loops
      quotaCooldownUntil = Date.now() + 45000;
      const quotaErr = new Error(
        'Gemini API embedding quota exceeded (HTTP 429). The API rate limit has been reached. Please check your Google AI Studio plan or wait a moment.'
      );
      quotaErr.status = 429;
      quotaErr.isQuotaError = true;
      throw quotaErr;
    }
    throw err;
  }
}

/**
 * Generates and stores embedding for a single email document.
 *
 * @param {string|Object} emailOrId - Email document or MongoDB _id
 * @returns {Promise<boolean>} True if embedding succeeded
 */
export async function embedEmail(emailOrId) {
  try {
    let email = emailOrId;
    if (typeof emailOrId === 'string' || emailOrId instanceof String) {
      email = await Email.findById(emailOrId);
    }
    if (!email) return false;

    // Check if already embedded
    if (email.embedding && Array.isArray(email.embedding) && email.embedding.length === config.ai.embeddingDimension) {
      return true;
    }

    const embeddingText = buildEmailEmbeddingText(email);
    const vector = await generateTextEmbedding(embeddingText);

    await Email.findByIdAndUpdate(email._id, {
      $set: { embedding: vector }
    });

    return true;
  } catch (err) {
    console.warn(`[EmbeddingService] Warning embedding email ${emailOrId?._id || emailOrId}:`, err.message);
    return false;
  }
}

/**
 * Finds all emails for a user that do not yet have an embedding and generates them with rate limiting.
 * Decoupled, throttled (600ms delay per call), and aborts immediately on 429 to protect account quota.
 *
 * @param {string} userId - User ID
 * @param {number} [maxBatch=15] - Maximum emails to process in one pass (default conservative 15 to stay within free-tier limits)
 * @returns {Promise<{ totalProcessed: number, succeeded: number, failed: number, quotaExceeded: boolean }>}
 */
export async function embedUnembeddedEmails(userId, maxBatch = 15) {
  const userKey = String(userId);
  const result = { totalProcessed: 0, succeeded: 0, failed: 0, quotaExceeded: false };

  // Concurrency guard: avoid duplicate concurrent batch executions for the same user
  if (activeBatchLocks.has(userKey)) {
    return result;
  }

  // Quota cooldown guard
  if (Date.now() < quotaCooldownUntil) {
    result.quotaExceeded = true;
    return result;
  }

  activeBatchLocks.add(userKey);

  try {
    // Find emails where embedding is missing or empty
    const unembeddedEmails = await Email.find({
      user: userId,
      $or: [
        { embedding: { $exists: false } },
        { embedding: null },
        { embedding: { $size: 0 } }
      ]
    })
      .select('+embedding')
      .limit(maxBatch)
      .lean();

    if (unembeddedEmails.length === 0) {
      return result;
    }

    result.totalProcessed = unembeddedEmails.length;

    for (const email of unembeddedEmails) {
      try {
        const text = buildEmailEmbeddingText(email);
        const vector = await generateTextEmbedding(text);

        await Email.findByIdAndUpdate(email._id, {
          $set: { embedding: vector }
        });

        result.succeeded++;

        // Respect Gemini rate limits: 600ms pacing delay between sequential calls
        await new Promise((resolve) => setTimeout(resolve, 600));
      } catch (itemErr) {
        result.failed++;
        console.warn(`[EmbeddingBatch] Item failed for email ${email._id}:`, itemErr.message);

        // If quota exceeded, abort the rest of the batch immediately to avoid burning quota
        if (itemErr.isQuotaError || itemErr.status === 429) {
          result.quotaExceeded = true;
          console.warn('[EmbeddingBatch] Aborting remaining batch items due to Gemini 429 quota exhaustion.');
          break;
        }
      }
    }
  } catch (batchErr) {
    console.error('[EmbeddingBatch] Error in batch embedding operation:', batchErr);
  } finally {
    activeBatchLocks.delete(userKey);
  }

  return result;
}
