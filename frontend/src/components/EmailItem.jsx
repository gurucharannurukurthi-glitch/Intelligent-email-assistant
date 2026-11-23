import React from 'react';
import { Star, Mail, MailOpen, Archive, Trash2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function formatEmailDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export function EmailItem({ email, onToggleStar, onToggleRead, onArchive, onDelete }) {
  const navigate = useNavigate();

  const handleRowClick = () => {
    navigate(`/thread/${email.threadId}`);
  };

  const senderName = email.sender?.name || email.sender?.email?.split('@')[0] || 'Unknown';
  const formattedDate = formatEmailDate(email.receivedAt);

  return (
    <div
      onClick={handleRowClick}
      style={{
        backgroundColor: email.isRead ? 'transparent' : 'var(--bg-unread)'
      }}
      className={`group relative p-3 sm:p-3.5 md:px-4 md:py-3 border-b theme-border cursor-pointer transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03] w-full min-w-0 ${
        email.isRead ? 'theme-text-muted' : 'theme-text-main'
      }`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. MOBILE VIEW (< md / < 768px):
             Focused multi-line layout:
             Line 1: Dot + Star + Sender + Date
             Line 2: Subject
             Line 3: Snippet preview (line-clamp-2)
             Line 4: AI Badge + Tappable Touch Actions
         ───────────────────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-col gap-1.5 w-full min-w-0">
        {/* Line 1: Sender & Date */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Unread indicator dot */}
            <div className="w-2 flex justify-center shrink-0">
              {!email.isRead && (
                <span className="w-2 h-2 rounded-full bg-brand-500 shadow-sm shadow-brand-500/50" />
              )}
            </div>

            {/* Star button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(email);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-amber-500 transition-colors shrink-0"
              title={email.isStarred ? 'Unstar' : 'Star'}
              aria-label={email.isStarred ? 'Unstar' : 'Star'}
            >
              <Star
                className={`w-4 h-4 ${
                  email.isStarred ? 'text-amber-400 fill-amber-400' : 'hover:fill-amber-400/20'
                }`}
              />
            </button>

            <span className={`truncate text-xs ${email.isRead ? 'theme-text-muted font-normal' : 'theme-text-main font-bold'}`}>
              {senderName}
            </span>
          </div>

          <span className="text-[10px] sm:text-[11px] opacity-60 shrink-0">
            {formattedDate}
          </span>
        </div>

        {/* Line 2: Subject */}
        <div className="pl-4 sm:pl-5 min-w-0">
          <div className={`truncate text-xs ${email.isRead ? 'theme-text-muted font-normal' : 'theme-text-main font-semibold'}`}>
            {email.subject || '(No Subject)'}
          </div>
        </div>

        {/* Line 3: Snippet Preview */}
        {(email.snippet || email.bodyText) && (
          <div className="pl-4 sm:pl-5 min-w-0">
            <p className="text-[11px] theme-text-muted line-clamp-2 leading-relaxed opacity-75 break-words">
              {email.snippet || email.bodyText?.substring(0, 120) || ''}
            </p>
          </div>
        )}

        {/* Line 4: Badges & Mobile Actions */}
        <div className="pl-4 sm:pl-5 pt-0.5 flex items-center justify-between gap-2 min-w-0">
          <div>
            {email.aiSummary && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                <Sparkles className="w-2.5 h-2.5" /> Summary
              </span>
            )}
          </div>

          {/* Direct Mobile Touch Action Buttons */}
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onToggleRead(email)}
              className="p-1.5 rounded-lg border theme-border theme-card theme-text-muted hover:theme-text-main transition-colors"
              title={email.isRead ? 'Mark as unread' : 'Mark as read'}
              aria-label={email.isRead ? 'Mark as unread' : 'Mark as read'}
            >
              {email.isRead ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onArchive(email)}
              className="p-1.5 rounded-lg border theme-border theme-card theme-text-muted hover:theme-text-main transition-colors"
              title="Archive"
              aria-label="Archive"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(email)}
              className="p-1.5 rounded-lg border theme-border theme-card theme-text-muted hover:text-red-500 transition-colors"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TABLET & DESKTOP VIEW (>= md / >= 768px):
             Single adaptive row layout:
             Dot | Star | Sender | Subject — Snippet | AI Badge | Date / Hover Actions
         ───────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex md:items-center md:gap-3 w-full min-w-0">
        {/* Unread indicator dot */}
        <div className="w-2 flex justify-center shrink-0">
          {!email.isRead && (
            <span className="w-2 h-2 rounded-full bg-brand-500 shadow-sm shadow-brand-500/50" />
          )}
        </div>

        {/* Star button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(email);
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-amber-500 transition-colors shrink-0"
          title={email.isStarred ? 'Unstar' : 'Star'}
          aria-label={email.isStarred ? 'Unstar' : 'Star'}
        >
          <Star
            className={`w-4 h-4 ${
              email.isStarred ? 'text-amber-400 fill-amber-400' : 'hover:fill-amber-400/20'
            }`}
          />
        </button>

        {/* Sender */}
        <div className="md:w-36 lg:w-44 shrink-0 min-w-0">
          <span className={`truncate block text-xs ${email.isRead ? 'theme-text-muted font-normal' : 'theme-text-main font-bold'}`}>
            {senderName}
          </span>
        </div>

        {/* Subject & Snippet */}
        <div className="flex-1 min-w-0 flex items-baseline gap-1.5 text-xs truncate">
          <span className={`truncate shrink-0 md:max-w-[45%] lg:max-w-none ${email.isRead ? 'theme-text-muted font-normal' : 'theme-text-main font-bold'}`}>
            {email.subject || '(No Subject)'}
          </span>
          <span className="opacity-55 truncate text-[11px] min-w-0 flex-1 hidden md:inline">
            — {email.snippet || email.bodyText?.substring(0, 100) || ''}
          </span>
        </div>

        {/* AI Summary chip */}
        {email.aiSummary && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
            <Sparkles className="w-2.5 h-2.5" /> Summary
          </span>
        )}

        {/* Date on Desktop (hidden on row hover when actions appear) */}
        <div className="w-16 text-right text-[11px] opacity-60 md:group-hover:hidden shrink-0">
          {formattedDate}
        </div>

        {/* Desktop Hover Action Buttons */}
        <div
          className="hidden md:group-hover:flex items-center gap-1 shrink-0 theme-card pl-1.5 rounded-lg shadow-sm border theme-border"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onToggleRead(email)}
            className="p-1.5 opacity-70 hover:opacity-100 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={email.isRead ? 'Mark as unread' : 'Mark as read'}
            aria-label={email.isRead ? 'Mark as unread' : 'Mark as read'}
          >
            {email.isRead ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onArchive(email)}
            className="p-1.5 opacity-70 hover:opacity-100 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Archive"
            aria-label="Archive"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(email)}
            className="p-1.5 opacity-70 hover:opacity-100 hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors"
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailItem;
