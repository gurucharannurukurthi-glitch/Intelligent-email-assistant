import React from 'react';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import { useNav } from '../store/NavContext';
import { Mail, RefreshCw, LogOut, Sparkles, Sun, Moon, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Navbar({ onSync, isSyncing }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { toggleMobileNav } = useNav();

  return (
    <header className="theme-header h-14 border-b theme-border px-2.5 sm:px-4 md:px-5 flex items-center justify-between sticky top-0 z-30 transition-colors w-full">
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          type="button"
          onClick={toggleMobileNav}
          className="md:hidden p-2 rounded-xl theme-card border theme-border hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all shrink-0 cursor-pointer"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-4 h-4 theme-text-main" />
        </button>

        {/* Logo & Product Brand */}
        <Link to="/dashboard" className="flex items-center gap-2 group min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform shrink-0">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold tracking-tight theme-text-main text-xs sm:text-sm md:text-base truncate">
              Intelligent Email
            </span>
            <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shrink-0">
              <Sparkles className="w-2.5 h-2.5" /> Workspace
            </span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
        {/* Sync Gmail Button */}
        {onSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold theme-card hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 rounded-xl border theme-border transition-all disabled:opacity-50 shadow-sm cursor-pointer"
            title="Sync inbox with Gmail"
            aria-label="Sync inbox with Gmail"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-brand-500 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Gmail'}</span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 theme-card hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 rounded-xl border theme-border transition-all shadow-sm flex items-center justify-center cursor-pointer"
          title={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-indigo-600" />
          )}
        </button>

        {/* User Account Chip */}
        {user && (
          <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2.5 border-l theme-border">
            <div className="flex items-center gap-2">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || 'User'}
                  className="w-7 h-7 rounded-full ring-2 ring-brand-500/30 shrink-0 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="hidden lg:block text-left">
                <div className="text-xs font-bold theme-text-main leading-tight truncate max-w-[120px]">
                  {user.name || 'User'}
                </div>
                <div className="text-[10px] theme-text-muted leading-tight truncate max-w-[120px]">
                  {user.email}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="p-1.5 sm:p-2 theme-text-muted hover:text-red-500 hover:bg-red-500/10 active:scale-95 rounded-lg transition-colors cursor-pointer"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
