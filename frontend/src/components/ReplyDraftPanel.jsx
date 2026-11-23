import React, { useState } from 'react';
import { Sparkles, Send, RefreshCw, CheckCircle } from 'lucide-react';
import api from '../services/api';

export function ReplyDraftPanel({
  emailId,
  replyTo,
  replySubject,
  threadId,
  onReplySent
}) {
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerateReply = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setSentSuccess(false);

      const res = await api.post(`/ai/draft-reply/${emailId}`);
      if (res.data?.draftText) {
        setDraft(res.data.draftText);
      }
    } catch (err) {
      console.error('Error generating AI reply:', err);
      setError(err.response?.data?.message || 'Failed to generate AI reply draft.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendReply = async () => {
    if (!draft.trim()) return;

    try {
      setIsSending(true);
      setError(null);

      await api.post('/emails/send', {
        to: replyTo,
        subject: replySubject,
        messageText: draft,
        threadId: threadId
      });

      setSentSuccess(true);
      setDraft('');
      if (onReplySent) {
        onReplySent();
      }
    } catch (err) {
      console.error('Error sending reply:', err);
      setError(err.response?.data?.message || 'Failed to send email via Gmail API.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="theme-card border theme-border rounded-2xl p-3.5 sm:p-5 space-y-3.5 shadow-md transition-colors w-full min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold theme-text-main">
          <Sparkles className="w-4 h-4 text-brand-500 shrink-0" />
          <span>AI Reply Assistant</span>
        </div>

        <button
          type="button"
          onClick={handleGenerateReply}
          disabled={isGenerating}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 active:scale-[0.98] border border-brand-500/30 rounded-xl transition-all disabled:opacity-50 shrink-0 w-full sm:w-auto cursor-pointer"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
          <span>{isGenerating ? 'Drafting...' : draft ? 'Regenerate Draft' : 'Draft AI Reply'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs text-red-700 dark:text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl break-words">
          {error}
        </div>
      )}

      {sentSuccess && (
        <div className="p-3 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Reply sent successfully through your connected Gmail account!</span>
        </div>
      )}

      {/* Editable Draft Textarea */}
      <div className="space-y-1.5">
        <div className="text-[11px] theme-text-muted flex items-center justify-between gap-2 flex-wrap">
          <span className="truncate">Replying to <strong className="theme-text-main">{replyTo}</strong>:</span>
          {draft && <span className="opacity-70 text-[10px]">Edit draft before sending</span>}
        </div>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Click 'Draft AI Reply' to generate a response, or write your reply directly here..."
          rows={5}
          className="theme-input w-full p-3 sm:p-3.5 text-xs sm:text-sm rounded-xl border theme-border focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-sans leading-relaxed resize-y max-w-full"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t theme-border">
        {draft && (
          <button
            type="button"
            onClick={() => setDraft('')}
            className="px-3 py-2 text-xs font-semibold theme-text-muted hover:theme-text-main transition-colors cursor-pointer"
          >
            Discard
          </button>
        )}

        <button
          type="button"
          onClick={handleSendReply}
          disabled={!draft.trim() || isSending}
          className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-brand-500/20 transition-all w-full sm:w-auto cursor-pointer"
        >
          {isSending ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Send Reply</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default ReplyDraftPanel;
