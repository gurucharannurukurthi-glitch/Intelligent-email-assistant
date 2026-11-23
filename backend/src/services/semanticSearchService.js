import mongoose from 'mongoose';
import { Email } from '../models/Email.js';
import { generateTextEmbedding } from './embeddingService.js';
import { config } from '../config/env.js';

// Common English stopwords to ignore during borderline relevance verification
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
  'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t',
  'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s',
  'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is',
  'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most',
  'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once',
  'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
  'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they',
  'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
  'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when',
  'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom',
  'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d',
  'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

function extractKeywords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Filter and rank vector search candidates using empirically calibrated thresholds
 * and dynamic score-gap windows to eliminate weak/unrelated background results.
 *
 * @param {Array<Object>} candidates - Consolidated thread candidates from Atlas
 * @param {string} queryText - Original natural language search query
 * @param {number} [maxResults=6] - Maximum number of high-precision results to return
 * @returns {Array<Object>} Calibrated, high-precision semantic results
 */
function filterAndRankCandidates(candidates, queryText, maxResults = 6) {
  if (!candidates || candidates.length === 0) {
    return [];
  }

  // Candidates are already sorted descending by similarity score
  const topScore = candidates[0].score || 0;

  // 1. Absolute significance floor
  const ABSOLUTE_MIN_THRESHOLD = 0.760;
  if (topScore < ABSOLUTE_MIN_THRESHOLD) {
    return [];
  }

  // 2. Dynamic Score-Gap Window:
  let relativeWindow = 0.015;
  if (topScore >= 0.83) {
    relativeWindow = 0.045;
  } else if (topScore >= 0.79) {
    relativeWindow = 0.030;
  }

  const scoreCutoff = Math.max(ABSOLUTE_MIN_THRESHOLD, topScore - relativeWindow);
  const queryTerms = extractKeywords(queryText);

  const filtered = [];

  for (const item of candidates) {
    if (item.score < scoreCutoff) continue;

    // High confidence match (score >= 0.78 or strong top match): accept directly
    if (item.score >= 0.78 || topScore >= 0.80) {
      filtered.push(item);
    } else {
      // Moderate/borderline match (0.76 - 0.779): verify that candidate has topical affinity
      // to eliminate flat background noise on unrelated queries
      const targetText = `${item.subject || ''} ${item.snippet || ''}`.toLowerCase();
      const hasTopicalAffinity = queryTerms.some((term) => targetText.includes(term.slice(0, 4)));

      if (hasTopicalAffinity) {
        filtered.push(item);
      }
    }

    if (filtered.length >= maxResults) break;
  }

  // 3. Assign honest, human-readable semantic relevance tiers
  return filtered.map((item) => {
    let tier = 'Possibly Relevant';
    let tierType = 'possible'; // 'strong' | 'relevant' | 'possible'

    if (item.score >= 0.82) {
      tier = 'Strongly Relevant';
      tierType = 'strong';
    } else if (item.score >= 0.78) {
      tier = 'Relevant';
      tierType = 'relevant';
    } else {
      tier = 'Possibly Relevant';
      tierType = 'possible';
    }

    return {
      ...item,
      relevanceTier: tier,
      relevanceTierType: tierType
    };
  });
}

/**
 * Executes a semantic vector search across a user's emails using MongoDB Atlas Vector Search ($vectorSearch).
 * Results are consolidated at the thread level and filtered with empirical relevance thresholds.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Target user ID
 * @param {string} query - Natural language search query
 * @param {Object} [options] - Search options
 * @param {number} [options.limit=6] - Max number of top results to return (default: 6)
 * @param {number} [options.numCandidates=50] - Number of nearest neighbors to evaluate in Atlas
 * @returns {Promise<Array<Object>>} Ranked, high-precision list of matched threads
 */
export async function searchEmailsSemantically(userId, query, options = {}) {
  if (!query || !query.trim()) {
    return [];
  }

  const cleanQuery = query.trim();
  const maxResults = options.limit ? Math.min(20, Math.max(1, parseInt(options.limit, 10))) : 6;
  const numCandidates = options.numCandidates || Math.max(maxResults * 8, 50);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 1. Generate query embedding using the locked Gemini embedding model
  const queryVector = await generateTextEmbedding(cleanQuery);

  // 2. Build MongoDB Atlas Vector Search Aggregation Pipeline
  const indexName = config.ai.vectorIndexName || 'vector_index';

  const pipeline = [
    {
      $vectorSearch: {
        index: indexName,
        path: 'embedding',
        queryVector,
        numCandidates,
        limit: numCandidates,
        filter: {
          user: { $eq: userObjectId }
        }
      }
    },
    {
      $project: {
        _id: 1,
        messageId: 1,
        threadId: 1,
        subject: 1,
        sender: 1,
        recipients: 1,
        snippet: 1,
        bodyText: 1,
        labels: 1,
        isRead: 1,
        isStarred: 1,
        isArchived: 1,
        receivedAt: 1,
        score: { $meta: 'vectorSearchScore' }
      }
    }
  ];

  let rawResults;
  try {
    rawResults = await Email.aggregate(pipeline);
  } catch (dbErr) {
    // Detect if running on an environment without MongoDB Atlas Vector Search
    if (dbErr.message && (dbErr.message.includes('$vectorSearch') || dbErr.message.includes('AtlasCLI'))) {
      console.error('[SemanticSearch] Atlas Vector Search error:', dbErr.message);
      throw new Error(
        `MongoDB Atlas Vector Search is not enabled on this database cluster or the index '${indexName}' has not been built yet. Please ensure your MongoDB Atlas cluster has a Vector Search index named '${indexName}' with numDimensions: ${config.ai.embeddingDimension}.`
      );
    }
    throw dbErr;
  }

  if (!rawResults || rawResults.length === 0) {
    return [];
  }

  // 3. Consolidate results by threadId (keeping the maximum scoring email per conversation thread)
  const threadMap = new Map();

  for (const item of rawResults) {
    const threadKey = item.threadId || item.messageId || String(item._id);
    const itemScore = typeof item.score === 'number' ? Math.round(item.score * 1000) / 1000 : 0;

    if (!threadMap.has(threadKey)) {
      let matchedSnippet = item.snippet || '';
      if (item.bodyText && item.bodyText.length > matchedSnippet.length) {
        matchedSnippet = item.bodyText.replace(/\s+/g, ' ').trim().slice(0, 220);
      }

      threadMap.set(threadKey, {
        _id: item._id,
        threadId: item.threadId || item.messageId,
        messageId: item.messageId,
        subject: item.subject || '(No Subject)',
        sender: item.sender || { name: '', email: '' },
        recipients: item.recipients || [],
        snippet: matchedSnippet,
        isRead: item.isRead,
        isStarred: item.isStarred,
        isArchived: item.isArchived,
        labels: item.labels || [],
        receivedAt: item.receivedAt,
        score: itemScore
      });
    } else {
      // If another email in this same thread scored higher, update the thread representation
      const existing = threadMap.get(threadKey);
      if (itemScore > existing.score) {
        let matchedSnippet = item.snippet || existing.snippet;
        if (item.bodyText && item.bodyText.length > matchedSnippet.length) {
          matchedSnippet = item.bodyText.replace(/\s+/g, ' ').trim().slice(0, 220);
        }
        existing._id = item._id;
        existing.messageId = item.messageId;
        existing.score = itemScore;
        existing.snippet = matchedSnippet;
      }
    }
  }

  // Sort candidate threads descending by top score
  const sortedCandidates = Array.from(threadMap.values()).sort((a, b) => (b.score || 0) - (a.score || 0));

  // 4. Apply empirical relevance filtering and tier classification
  return filterAndRankCandidates(sortedCandidates, cleanQuery, maxResults);
}
