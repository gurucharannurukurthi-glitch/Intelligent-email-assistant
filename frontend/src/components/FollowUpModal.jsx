import React, { useState, useEffect } from 'react';
import { X, Send, Sparkles, AlertCircle, RefreshCw, UserCheck, MessageSquare } from 'lucide-react';

export function FollowUpModal({
  isOpen,
  onClose,
  followUp,
  draftData,
  onSend,
  isSending,
  onRegenerate,
  isRegenerating
}) {
  if (!isOpen || !followUp) return null;

  const [messageText, setMessageText] = useState(draftData?.draftText || '');
  const [subject, setSubject] = useState(
    draftData?.subject || `Re: ${followUp.subject || '(No Subject)'}`
  );

  useEffect(() => {
    if (draftData?.draftText) {
      setMessageText(draftData.draftText);
    }
    if (draftData?.subject) {
      setSubject(draftData.subject);
    }
  }, [draftData]);

  // Accessibility: Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    onSend({
      followUpId: followUp._id,
      subject: subject.trim(),
      messageText: messageText.trim()
    });
  };

  const recipientDisplay = followUp.recipient?.name
    ? `${followUp.recipient.name} <${followUp.recipient.email}>`
    : followUp.recipient?.email || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="theme-card border theme-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b theme-border bg-brand-500/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shrink-0">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-bold theme-text-main text-sm sm:text-base">Review &amp; Send Follow-up</h3>
              <p className="text-[11px] sm:text-xs theme-text-muted">
                Review the AI draft and edit before sending via Gmail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg theme-text-muted hover:theme-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* AI Context Reason Callout */}
        <div className="px-4 sm:px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Context: </span>
            {followUp.reason || 'Follow-up suggested for your sent message.'}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1">
          {/* Recipient & Subject Header */}
          <div className="space-y-2.5 p-3 rounded-xl theme-card border theme-border bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold theme-text-muted w-14 shrink-0">To:</span>
              <span className="font-bold theme-text-main truncate flex-1 min-w-0">{recipientDisplay}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold theme-text-muted w-14 shrink-0">Subject:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="flex-1 px-2.5 py-1.5 rounded-lg theme-card border theme-border focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium theme-text-main text-xs min-w-0"
              />
            </div>
          </div>

          {/* Editable Draft Text */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="font-bold theme-text-main flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                <span>Message Draft (Fully Editable)</span>
              </label>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                  <span>Regenerate Draft</span>
                </button>
              )}
            </div>
            <textarea
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              required
              placeholder="Write or edit your follow-up message..."
              className="w-full p-3 rounded-xl theme-card border theme-border focus:outline-none focus:ring-2 focus:ring-brand-500/30 font-sans leading-relaxed theme-text-main text-xs resize-y"
            />
          </div>

          <div className="text-[11px] theme-text-muted flex items-center gap-1.5 opacity-80">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>This email will be sent directly through your Gmail account when you confirm.</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t theme-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl theme-input hover:opacity-80 text-xs font-semibold theme-text-main transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending || !messageText.trim()}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isSending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isSending ? 'Sending...' : 'Send Follow-up'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FollowUpModal;
