import React from 'react';
import { useNotification } from '../store/NotificationContext';
import { Mail, X, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NotificationToast() {
  const { notifications, removeNotification } = useNotification();
  const navigate = useNavigate();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-3 left-3 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex flex-col gap-2.5 sm:gap-3 sm:max-w-sm pointer-events-none">
      {notifications.map((notif) => {
        const senderName = notif.sender?.name || notif.sender?.email || 'New Email';

        return (
          <div
            key={notif.id}
            className="pointer-events-auto theme-card p-4 rounded-2xl border theme-border shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shrink-0 shadow-md shadow-brand-500/25">
                  <Mail className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold theme-text-main truncate">
                      {senderName}
                    </span>
                    <span className="flex items-center text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400">
                      New
                    </span>
                  </div>
                  <div className="text-xs font-medium theme-text-main truncate mt-0.5">
                    {notif.subject || '(No Subject)'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => removeNotification(notif.id)}
                className="p-1 opacity-60 hover:opacity-100 theme-text-muted rounded-lg transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {notif.snippet && (
              <p className="text-xs theme-text-muted mt-2 line-clamp-2 leading-relaxed">
                {notif.snippet}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t theme-border">
              <button
                onClick={() => {
                  removeNotification(notif.id);
                  if (notif.threadId) {
                    navigate(`/thread/${notif.threadId}`);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-all"
              >
                <span>View Email</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
