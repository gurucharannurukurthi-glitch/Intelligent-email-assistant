import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Star, Mail, MailOpen, Archive, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export function EmailDetail({
  email,
  isLatest = false,
  onToggleStar,
  onToggleRead,
  onArchive,
  onDelete
}) {
  const [isExpanded, setIsExpanded] = useState(isLatest);

  const formattedDate = email.receivedAt
    ? new Date(email.receivedAt).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  const senderInitial = (email.sender?.name || email.sender?.email || 'U')[0].toUpperCase();
  const sanitizedHtml = email.bodyHtml ? DOMPurify.sanitize(email.bodyHtml) : '';

  return (
    <div className="theme-card border theme-border rounded-2xl overflow-hidden shadow-sm transition-all w-full min-w-0">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs sm:text-sm shrink-0 shadow-sm">
            {senderInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs sm:text-sm theme-text-main truncate">
                {email.sender?.name || 'Unknown Sender'}
              </span>
              <span className="text-[11px] theme-text-muted truncate hidden sm:inline">
                &lt;{email.sender?.email}&gt;
              </span>
            </div>
            <div className="text-[11px] theme-text-muted truncate">
              to {email.recipients?.map((r) => r.name || r.email).join(', ') || 'me'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 theme-border" onClick={(e) => e.stopPropagation()}>
          <span className="text-[11px] theme-text-muted">{formattedDate}</span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleStar(email)}
              className="p-1.5 rounded-lg theme-card border theme-border hover:text-amber-500 active:scale-95 transition-all cursor-pointer"
              title={email.isStarred ? 'Unstar' : 'Star'}
              aria-label={email.isStarred ? 'Unstar' : 'Star'}
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  email.isStarred ? 'text-amber-400 fill-amber-400' : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => onToggleRead(email)}
              className="p-1.5 rounded-lg theme-card border theme-border hover:opacity-80 active:scale-95 transition-all cursor-pointer"
              title={email.isRead ? 'Mark as unread' : 'Mark as read'}
              aria-label={email.isRead ? 'Mark as unread' : 'Mark as read'}
            >
              {email.isRead ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => onArchive(email)}
              className="p-1.5 rounded-lg theme-card border theme-border hover:opacity-80 active:scale-95 transition-all cursor-pointer"
              title="Archive"
              aria-label="Archive"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onDelete(email)}
              className="p-1.5 rounded-lg theme-card border theme-border hover:text-red-500 active:scale-95 transition-all cursor-pointer"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 opacity-70 hover:opacity-100 theme-text-muted ml-1 cursor-pointer"
              aria-label={isExpanded ? 'Collapse email' : 'Expand email'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="px-3.5 sm:px-6 py-4 sm:py-5 border-t theme-border theme-text-main text-xs sm:text-sm leading-relaxed overflow-x-auto break-words [overflow-wrap:anywhere] max-w-full">
          {sanitizedHtml ? (
            <div
              className="prose dark:prose-invert max-w-none prose-p:my-2 prose-img:max-w-full prose-table:overflow-x-auto [&_table]:max-w-full [&_table]:overflow-x-auto [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_img]:max-w-full [&_img]:h-auto [&_a]:break-all"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <div className="whitespace-pre-wrap font-sans break-words [overflow-wrap:anywhere]">{email.bodyText || email.snippet}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default EmailDetail;
