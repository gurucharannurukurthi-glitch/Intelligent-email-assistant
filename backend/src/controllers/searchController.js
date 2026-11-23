import * as semanticSearchService from '../services/semanticSearchService.js';
import * as embeddingService from '../services/embeddingService.js';
import { Email } from '../models/Email.js';

export async function semanticSearch(req, res, next) {
  try {
    const { q = '', limit = 20 } = req.query;

    if (!q || !q.trim()) {
      return res.json({
        success: true,
        query: '',
        count: 0,
        results: []
      });
    }

    const results = await semanticSearchService.searchEmailsSemantically(
      req.user._id,
      q,
      { limit: parseInt(limit, 10) }
    );

    res.json({
      success: true,
      query: q.trim(),
      count: results.length,
      results
    });
  } catch (error) {
    if (error.isQuotaError || error.status === 429) {
      return res.status(429).json({
        success: false,
        errorType: 'QUOTA_EXHAUSTED',
        message:
          'Gemini API embedding quota exceeded (HTTP 429). The API rate limit has been reached. Please wait a moment or check your Google AI Studio plan.'
      });
    }

    if (error.message && (error.message.includes('Atlas Vector Search') || error.message.includes('$vectorSearch'))) {
      return res.status(503).json({
        success: false,
        errorType: 'ATLAS_INDEX_REQUIRED',
        message: error.message
      });
    }

    next(error);
  }
}

export async function backfillEmbeddings(req, res, next) {
  try {
    const maxBatch = req.body?.maxBatch ? parseInt(req.body.maxBatch, 10) : 15;
    const stats = await embeddingService.embedUnembeddedEmails(req.user._id, maxBatch);

    if (stats.quotaExceeded) {
      return res.status(429).json({
        success: false,
        errorType: 'QUOTA_EXHAUSTED',
        message: 'Gemini API rate limit reached during batch indexing. Indexed partial batch; please wait before continuing.',
        ...stats
      });
    }

    res.json({
      success: true,
      message: 'Embedding batch processing complete',
      ...stats
    });
  } catch (error) {
    if (error.isQuotaError || error.status === 429) {
      return res.status(429).json({
        success: false,
        errorType: 'QUOTA_EXHAUSTED',
        message: 'Gemini API embedding quota exceeded. Please wait a moment before trying again.'
      });
    }
    next(error);
  }
}

export async function getEmbeddingStatus(req, res, next) {
  try {
    const userId = req.user._id;

    const [totalEmails, embeddedEmails] = await Promise.all([
      Email.countDocuments({ user: userId }),
      Email.countDocuments({
        user: userId,
        embedding: { $exists: true, $ne: null, $not: { $size: 0 } }
      })
    ]);

    res.json({
      success: true,
      totalEmails,
      embeddedEmails,
      pendingEmails: Math.max(0, totalEmails - embeddedEmails)
    });
  } catch (error) {
    next(error);
  }
}
