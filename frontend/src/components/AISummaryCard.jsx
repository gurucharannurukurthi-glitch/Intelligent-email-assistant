import React, { useMemo } from 'react';
import { Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function AISummaryCard({ summary, isSummarizing, onGenerateSummary, isCached }) {
  // Memoize sanitized HTML generation
  const sanitizedHtml = useMemo(() => {
    if (!summary) return '';
    const rawHtml = marked.parse(summary, { breaks: true, gfm: true });
    return DOMPurify.sanitize(rawHtml);
  }, [summary]);

  if (!summary && !isSummarizing) {
    return (
      <div className="p-3.5 sm:p-4 rounded-2xl theme-card border border-purple-500/25 bg-gradient-to-r from-purple-500/5 via-transparent to-purple-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-all w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold theme-text-main">AI Executive Summary</h4>
            <p className="text-[11px] theme-text-muted leading-relaxed">
              Synthesize key decisions, topic overview, and action items in one click.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onGenerateSummary}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:scale-[0.98] rounded-xl shadow-md shadow-purple-500/20 transition-all shrink-0 w-full sm:w-auto cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Summarize Thread</span>
        </button>
      </div>
    );
  }

  if (isSummarizing) {
    return (
      <div className="p-3.5 sm:p-4 rounded-2xl theme-card border border-purple-500/25 animate-pulse space-y-2.5 shadow-sm w-full min-w-0">
        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-xs font-bold">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Synthesizing conversation thread...</span>
        </div>
        <div className="h-2.5 theme-input rounded w-full"></div>
        <div className="h-2.5 theme-input rounded w-5/6"></div>
        <div className="h-2.5 theme-input rounded w-3/4"></div>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl theme-card border border-purple-500/30 shadow-sm space-y-2.5 transition-colors bg-gradient-to-r from-purple-500/5 via-transparent to-transparent w-full min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 flex-wrap">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Executive Summary</span>
          {isCached && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full theme-input theme-text-muted border theme-border font-normal">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Cached
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onGenerateSummary}
          className="text-xs theme-text-muted hover:theme-text-main flex items-center gap-1 transition-colors py-1 px-1.5 rounded-lg cursor-pointer"
          title="Regenerate Summary"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Regenerate</span>
        </button>
      </div>

      <div
        className="ai-summary-content text-xs pl-2 font-sans border-l-2 border-purple-500/60 leading-relaxed break-words [overflow-wrap:anywhere]"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  );
}

export default AISummaryCard;
