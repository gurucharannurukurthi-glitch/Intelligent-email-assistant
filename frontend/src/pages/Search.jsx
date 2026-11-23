import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { SearchSkeleton } from '../components/LoadingSkeleton';
import {
  Sparkles,
  Search as SearchIcon,
  RefreshCw,
  Calendar,
  Star,
  ArrowRight,
  AlertTriangle,
  X,
  Layers,
  Inbox
} from 'lucide-react';
import api from '../services/api';

const EXAMPLE_QUERIES = [
  'internship opportunities',
  'interview preparation and assessments',
  'account credentials and verification codes',
  'workshop registrations',
  'follow-up required'
];

export function Search() {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);

  // Status & backfill tracking
  const [status, setStatus] = useState(null);
  const [isBackfilling, setIsBackfilling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/emails/embeddings/status');
      if (res.data?.success) {
        setStatus(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch embedding status:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSearch = async (searchTerm = query) => {
    const term = searchTerm.trim();
    if (!term) return;

    try {
      setLoading(true);
      setErrorInfo(null);
      setActiveQuery(term);
      setHasSearched(true);

      const res = await api.get('/emails/search/semantic', {
        params: { q: term, limit: 6 }
      });

      setResults(res.data.results || []);
    } catch (err) {
      console.error('Semantic search error:', err);
      const status = err.response?.status;
      const data = err.response?.data;

      if (status === 429 || data?.errorType === 'QUOTA_EXHAUSTED') {
        setErrorInfo({
          type: 'QUOTA',
          message:
            data?.message ||
            'Gemini API rate limit reached. Please wait a moment or check your Google AI Studio quota.'
        });
      } else if (status === 503 || data?.errorType === 'ATLAS_INDEX_REQUIRED') {
        setErrorInfo({
          type: 'ATLAS',
          message:
            data?.message ||
            "MongoDB Atlas Vector Search index 'vector_index' is required on intelligent_email_assistant.emails."
        });
      } else {
        setErrorInfo({
          type: 'GENERAL',
          message: data?.message || err.message || 'Semantic search failed. Please try again.'
        });
      }
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(query);
    }
  };

  const handleBackfill = async () => {
    try {
      setIsBackfilling(true);
      setErrorInfo(null);
      await api.post('/emails/embeddings/backfill', { maxBatch: 15 });
      await fetchStatus();
    } catch (err) {
      console.error('Backfill error:', err);
      const data = err.response?.data;
      if (err.response?.status === 429 || data?.errorType === 'QUOTA_EXHAUSTED') {
        setErrorInfo({
          type: 'QUOTA',
          message: 'Rate limit reached during indexing. Please wait a minute.'
        });
      } else {
        setErrorInfo({
          type: 'GENERAL',
          message: data?.message || 'Failed to update email embeddings.'
        });
      }
      await fetchStatus();
    } finally {
      setIsBackfilling(false);
    }
  };

  return (
    <div className="theme-app-bg min-h-screen flex flex-col transition-colors">
      <Navbar />

      <div className="flex-1 flex min-h-0">
        <Sidebar currentFolder="SEARCH" onSelectFolder={() => navigate('/dashboard')} />

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-5 max-w-5xl mx-auto w-full min-w-0">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b theme-border">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h1 className="text-lg sm:text-xl font-bold theme-text-main tracking-tight">Semantic Memory</h1>
              </div>
              <p className="text-xs theme-text-muted mt-1">
                Find conversations by meaning, concepts, and context rather than exact keywords.
              </p>
            </div>

            {/* Embedding Status Badge */}
            {status && (
              <div className="flex items-center gap-2.5 bg-purple-500/5 dark:bg-purple-500/10 border theme-border px-3 py-1.5 rounded-xl text-xs shrink-0 self-start sm:self-auto">
                <div>
                  <div className="font-semibold text-xs theme-text-main flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Memory Status</span>
                  </div>
                  <div className="text-[11px] theme-text-muted">
                    {status.embeddedEmails} of {status.totalEmails} indexed
                  </div>
                </div>
                {status.pendingEmails > 0 && (
                  <button
                    onClick={handleBackfill}
                    disabled={isBackfilling}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white font-medium transition-all disabled:opacity-50 text-xs shadow-sm cursor-pointer"
                    title="Generate embeddings for pending emails"
                    aria-label="Generate embeddings for pending emails"
                  >
                    <RefreshCw className={`w-3 h-3 ${isBackfilling ? 'animate-spin' : ''}`} />
                    <span>{isBackfilling ? 'Indexing...' : `Index (${status.pendingEmails})`}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Primary Search Input */}
          <div className="relative w-full">
            <div className="relative flex items-center">
              <SearchIcon className="w-4 h-4 absolute left-3.5 text-purple-500 dark:text-purple-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by meaning... (e.g. 'project tasks', 'flight receipts')"
                className="w-full pl-10 pr-20 sm:pr-28 py-2.5 sm:py-3 rounded-2xl theme-card border border-purple-500/30 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-xs sm:text-sm theme-text-main shadow-sm transition-all"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-12 sm:right-24 p-1.5 rounded-lg theme-text-muted hover:theme-text-main transition-colors cursor-pointer"
                  aria-label="Clear search query"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSearch(query)}
                disabled={loading || !query.trim()}
                className="absolute right-1.5 sm:right-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.98] disabled:opacity-40 text-white font-semibold text-xs shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Search"
                aria-label="Search"
              >
                {loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </div>

          {/* Prompt Suggestions */}
          {!hasSearched && (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold theme-text-muted uppercase tracking-wider">
                Try searching for concepts like:
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {EXAMPLE_QUERIES.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(example);
                      handleSearch(example);
                    }}
                    className="text-xs py-1.5 px-2.5 sm:px-3 rounded-xl theme-card border theme-border hover:border-purple-500/40 hover:bg-purple-500/5 active:scale-[0.98] theme-text-main transition-all flex items-center gap-1.5 group shadow-sm text-left max-w-full cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-purple-500 group-hover:scale-110 transition-transform shrink-0" />
                    <span className="truncate">{example}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Structured Error Notice */}
          {errorInfo && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 shadow-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              <div className="flex-1 space-y-1 min-w-0">
                <div className="font-bold text-xs">Search Notice</div>
                <div className="leading-relaxed opacity-90 break-words">{errorInfo.message}</div>
              </div>
              <button onClick={() => setErrorInfo(null)} className="font-bold hover:underline ml-2 shrink-0 cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && <SearchSkeleton />}

          {/* Search Results */}
          {!loading && hasSearched && !errorInfo && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs theme-text-muted px-1">
                <span className="truncate">
                  Found <strong className="theme-text-main">{results.length}</strong> matching conversation
                  {results.length === 1 ? '' : 's'} for &ldquo;{activeQuery}&rdquo;
                </span>
              </div>

              {results.length === 0 ? (
                <div className="p-8 sm:p-12 text-center theme-card border theme-border rounded-2xl space-y-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 mx-auto flex items-center justify-center">
                    <SearchIcon className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold theme-text-main">No relevant conversations found</div>
                  <div className="text-xs theme-text-muted max-w-md mx-auto">
                    We could not find emails matching the concept of this query. Try phrasing your search with different words.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((item) => {
                    const senderName = item.sender?.name || item.sender?.email || 'Unknown';
                    const senderInitial = (senderName[0] || 'U').toUpperCase();
                    const dateStr = item.receivedAt
                      ? new Date(item.receivedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      : '';

                    // Relevance Tier Badges
                    let badgeClass = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
                    let dotColor = 'bg-indigo-500';

                    if (item.relevanceTierType === 'strong') {
                      badgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold';
                      dotColor = 'bg-emerald-500';
                    } else if (item.relevanceTierType === 'relevant') {
                      badgeClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-medium';
                      dotColor = 'bg-blue-500';
                    }

                    return (
                      <div
                        key={item._id || item.threadId}
                        onClick={() => navigate(`/thread/${item.threadId}`)}
                        className="p-3.5 sm:p-4 rounded-2xl theme-card border theme-border hover:border-purple-500/40 hover:shadow-sm transition-all cursor-pointer group space-y-2.5 w-full min-w-0"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-xs text-purple-600 dark:text-purple-400 shrink-0">
                              {senderInitial}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold theme-text-main truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                {item.subject}
                              </div>
                              <div className="text-[11px] theme-text-muted truncate">
                                From: <span className="font-medium">{senderName}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] border flex items-center gap-1 ${badgeClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                              <span>{item.relevanceTier || 'Relevant'}</span>
                            </span>

                            <div className="text-[11px] theme-text-muted flex items-center gap-1">
                              <Calendar className="w-3 h-3 opacity-60" />
                              <span>{dateStr}</span>
                            </div>
                          </div>
                        </div>

                        {/* Semantic Snippet */}
                        {item.snippet && (
                          <div className="text-xs theme-text-muted leading-relaxed line-clamp-2 pl-0 sm:pl-9 break-words">
                            {item.snippet}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t theme-border pl-0 sm:pl-9 text-xs">
                          <div className="flex items-center gap-2">
                            {item.isStarred && (
                              <span className="flex items-center gap-1 text-amber-500 text-[11px]">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Starred
                              </span>
                            )}
                            {!item.isRead && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
                                Unread
                              </span>
                            )}
                          </div>

                          <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400 text-xs group-hover:translate-x-0.5 transition-transform">
                            Open conversation <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Search;
