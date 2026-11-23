import React, { useState, useEffect } from 'react';
import { EmailItem } from './EmailItem';
import { EmailListSkeleton } from './LoadingSkeleton';
import { Inbox, Search, X, Layers, Star, Send, Trash2 } from 'lucide-react';

export function EmailList({
  emails = [],
  loading = false,
  total = 0,
  folder = 'INBOX',
  search = '',
  onSearchChange,
  onToggleStar,
  onToggleRead,
  onArchive,
  onDelete
}) {
  const [localSearch, setLocalSearch] = useState(search);

  // Sync external search updates
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search updates to parent by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [localSearch, search, onSearchChange]);

  const handleClear = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  const getFolderMeta = () => {
    switch (folder) {
      case 'STARRED':
        return { title: 'Starred', icon: Star, emptyMsg: 'No starred emails yet.' };
      case 'SENT':
        return { title: 'Sent', icon: Send, emptyMsg: 'No sent messages.' };
      case 'TRASH':
        return { title: 'Trash', icon: Trash2, emptyMsg: 'Trash is empty.' };
      case 'INBOX':
      default:
        return { title: 'Inbox', icon: Inbox, emptyMsg: 'Your inbox is clear.' };
    }
  };

  const folderMeta = getFolderMeta();
  const FolderIcon = folderMeta.icon;

  return (
    <div className="theme-app-bg flex-1 flex flex-col min-h-0 w-full min-w-0">
      {/* List Toolbar & Search Bar */}
      <div className="theme-header px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 border-b theme-border flex items-center justify-between gap-2.5 sm:gap-4 transition-colors shrink-0">
        <div className="relative flex-1 min-w-0 max-w-xl">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={`Filter ${folderMeta.title.toLowerCase()}...`}
            className="theme-input w-full pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 text-xs rounded-xl border theme-border focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all shadow-sm font-medium"
          />
          {localSearch && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-60 hover:opacity-100 rounded-lg theme-text-muted cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Folder Title & Count */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs theme-text-muted shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 font-bold theme-text-main">
            <FolderIcon className="w-3.5 h-3.5 text-brand-500" />
            <span>{folderMeta.title}</span>
          </div>
          <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold border border-brand-500/20">
            {emails.length}
          </span>
        </div>
      </div>

      {/* Email Rows List */}
      <div className="flex-1 overflow-y-auto divide-y theme-border w-full min-w-0">
        {loading ? (
          <EmailListSkeleton count={10} />
        ) : emails.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4 sm:p-6 theme-text-muted space-y-2">
            <div className="w-10 h-10 rounded-2xl theme-input border theme-border flex items-center justify-center">
              <FolderIcon className="w-5 h-5 opacity-40 text-brand-500" />
            </div>
            <p className="text-sm font-semibold theme-text-main">{folderMeta.emptyMsg}</p>
            <p className="text-xs theme-text-muted max-w-sm px-2">
              {localSearch
                ? 'No messages matched your filter query.'
                : 'Click "Sync Gmail" in the top bar to update your mailbox from Google.'}
            </p>
          </div>
        ) : (
          emails.map((email) => (
            <EmailItem
              key={email._id || email.messageId}
              email={email}
              onToggleStar={onToggleStar}
              onToggleRead={onToggleRead}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default EmailList;
