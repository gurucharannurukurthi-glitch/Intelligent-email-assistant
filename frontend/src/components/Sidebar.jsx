import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNav } from '../store/NavContext';
import {
  Inbox,
  Star,
  Send,
  Trash2,
  PenSquare,
  Sparkles,
  ListTodo,
  X,
  Mail
} from 'lucide-react';

export function Sidebar({ currentFolder = 'INBOX', onSelectFolder }) {
  const location = useLocation();
  const { isMobileNavOpen, closeMobileNav } = useNav();
  const isComposePage = location.pathname === '/compose';
  const isSearchPage = location.pathname === '/search';
  const isActionCenterPage = location.pathname === '/action-center';

  // Close mobile nav drawer when Escape key is pressed
  useEffect(() => {
    if (!isMobileNavOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeMobileNav();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavOpen, closeMobileNav]);

  const navItems = [
    { id: 'INBOX', label: 'Inbox', icon: Inbox },
    { id: 'STARRED', label: 'Starred', icon: Star },
    { id: 'SENT', label: 'Sent', icon: Send },
    { id: 'TRASH', label: 'Trash', icon: Trash2 },
  ];

  const handleFolderClick = (id) => {
    if (onSelectFolder) onSelectFolder(id);
    closeMobileNav();
  };

  const navContent = (
    <div className="space-y-4 md:space-y-3.5 lg:space-y-5 flex-1">
      {/* Compose Button */}
      <div>
        <Link
          to="/compose"
          onClick={closeMobileNav}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 md:px-3 lg:px-4 rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition-all ${
            isComposePage
              ? 'bg-brand-600 text-white shadow-brand-500/25 ring-2 ring-brand-400/40'
              : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-500/15 hover:shadow-md hover:scale-[1.01]'
          }`}
        >
          <PenSquare className="w-4 h-4 shrink-0" />
          <span className="truncate">Compose</span>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="space-y-3.5 md:space-y-3 lg:space-y-4">
        {/* Section: WORKSPACE */}
        <div className="space-y-1">
          <div className="text-[10px] lg:text-[11px] font-bold theme-text-muted uppercase tracking-wider px-2.5 lg:px-3 mb-1.5 opacity-75">
            Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = !isComposePage && !isSearchPage && !isActionCenterPage && currentFolder === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleFolderClick(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 lg:px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400 font-semibold shadow-sm border border-brand-500/20'
                    : 'theme-text-muted hover:theme-text-main hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'opacity-70'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section: AI MEMORY */}
        <div className="space-y-1">
          <div className="text-[10px] lg:text-[11px] font-bold theme-text-muted uppercase tracking-wider px-2.5 lg:px-3 mb-1.5 opacity-75">
            AI Memory
          </div>
          <Link
            to="/search"
            onClick={closeMobileNav}
            className={`w-full flex items-center gap-2.5 px-2.5 lg:px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isSearchPage
                ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold shadow-sm border border-purple-500/25'
                : 'theme-text-muted hover:theme-text-main hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Sparkles className={`w-4 h-4 shrink-0 ${isSearchPage ? 'text-purple-600 dark:text-purple-400' : 'text-purple-500 opacity-80'}`} />
            <span className="truncate">Semantic Search</span>
          </Link>
        </div>

        {/* Section: ACTIONS */}
        <div className="space-y-1">
          <div className="text-[10px] lg:text-[11px] font-bold theme-text-muted uppercase tracking-wider px-2.5 lg:px-3 mb-1.5 opacity-75">
            Actions
          </div>
          <Link
            to="/action-center"
            onClick={closeMobileNav}
            className={`w-full flex items-center gap-2.5 px-2.5 lg:px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isActionCenterPage
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold shadow-sm border border-amber-500/25'
                : 'theme-text-muted hover:theme-text-main hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <ListTodo className={`w-4 h-4 shrink-0 ${isActionCenterPage ? 'text-amber-600 dark:text-amber-400' : 'text-amber-500 opacity-80'}`} />
            <span className="truncate">Action Center</span>
          </Link>
        </div>
      </nav>
    </div>
  );

  const footerStatus = (
    <div className="p-2.5 lg:p-3 rounded-xl theme-card border theme-border text-[10px] lg:text-[11px] theme-text-muted shadow-sm space-y-1 mt-3">
      <div className="font-semibold theme-text-main flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="truncate">Gmail Synced</span>
      </div>
      <div className="opacity-75 text-[10px] leading-tight truncate">
        OAuth 2.0 Connected
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop & Tablet Static Sidebar:
          - Tablet (768px-1023px): compact md:w-48 md:p-2.5 leaves 576px+ for main content
          - Desktop (>= 1024px): comfortable lg:w-60 lg:p-3.5
          - Mobile (< 768px): completely hidden from main flow, rendered in slide-over drawer below
      */}
      <aside className="hidden md:flex theme-sidebar md:w-48 lg:w-60 border-r theme-border md:p-2.5 lg:p-3.5 flex-col justify-between shrink-0 transition-colors select-none">
        {navContent}
        {footerStatus}
      </aside>

      {/* 2. Mobile Slide-Over Navigation Drawer */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={closeMobileNav}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-64 sm:w-72 max-w-[85vw] theme-sidebar border-r theme-border p-4 flex flex-col justify-between shadow-2xl z-10 transition-transform overflow-y-auto">
            <div className="space-y-4">
              {/* Drawer Top Header with Close Button */}
              <div className="flex items-center justify-between pb-3 border-b theme-border">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-sm shrink-0">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold theme-text-main text-sm truncate">Navigation</span>
                </div>
                <button
                  type="button"
                  onClick={closeMobileNav}
                  className="p-2 rounded-xl theme-card border theme-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                  aria-label="Close navigation menu"
                >
                  <X className="w-4 h-4 theme-text-main" />
                </button>
              </div>

              {navContent}
            </div>

            {footerStatus}
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
