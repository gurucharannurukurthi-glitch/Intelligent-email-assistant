import React from 'react';
import { useAuth } from '../store/AuthContext';
import { useTheme } from '../store/ThemeContext';
import {
  Mail,
  Sparkles,
  Lock,
  AlertCircle,
  Sun,
  Moon,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Brain,
  ListTodo
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export function Login() {
  const { loginWithGoogle, reauthMessage } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get('error');

  const getErrorMessage = () => {
    if (reauthMessage) return reauthMessage;
    if (errorParam === 'auth_failed') return 'Google Authentication failed. Please try again.';
    if (errorParam === 'missing_code') return 'Missing authorization code from Google.';
    if (errorParam === 'invalid_state') return 'Security validation failed (OAuth state mismatch). Please try logging in again.';
    if (errorParam === 'state_expired') return 'Authentication request expired. Please try logging in again.';
    if (errorParam === 'session_error') return 'Session error occurred during sign-in. Please try again.';
    if (errorParam) return `Authentication Error: ${errorParam}`;
    return null;
  };

  const errorMessage = getErrorMessage();

  return (
    <div className="theme-app-bg min-h-screen flex flex-col justify-between transition-colors relative overflow-hidden font-sans">
      {/* Subtle ambient lighting */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="theme-header border-b theme-border px-4 sm:px-6 py-3.5 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Mail className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base theme-text-main tracking-tight">
              Intelligent Email
            </span>
            <span className="hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              Workspace
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 theme-card hover:bg-black/5 dark:hover:bg-white/5 rounded-xl border theme-border transition-all shadow-sm flex items-center justify-center cursor-pointer"
          title={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>
      </header>

      {/* Main Hero Grid */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-12 z-10 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center w-full">
          {/* Left Column: 3-Layer Product Architecture */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI-Powered Email Workspace</span>
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight theme-text-main leading-tight">
                Understand, Remember &amp; Act on your{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500">
                  Inbox
                </span>
              </h1>
              <p className="text-xs sm:text-sm md:text-base theme-text-muted leading-relaxed max-w-xl">
                A unified intelligence layer that synthesizes threads, retrieves past conversations by meaning, and turns emails into calendar events, tasks, and follow-ups.
              </p>
            </div>

            {/* 3 Product Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
              {/* Layer 1: Understand */}
              <div className="theme-card p-3 sm:p-3.5 rounded-2xl border theme-border shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>1. Understand</span>
                </div>
                <p className="text-[11px] theme-text-muted leading-relaxed">
                  Executive summaries &amp; contextual reply drafting with manual edit control.
                </p>
              </div>

              {/* Layer 2: Remember */}
              <div className="theme-card p-3 sm:p-3.5 rounded-2xl border theme-border shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400">
                  <Brain className="w-3.5 h-3.5" />
                  <span>2. Remember</span>
                </div>
                <p className="text-[11px] theme-text-muted leading-relaxed">
                  Semantic memory search across your mailbox by concepts rather than keywords.
                </p>
              </div>

              {/* Layer 3: Act */}
              <div className="theme-card p-3 sm:p-3.5 rounded-2xl border theme-border shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>3. Act</span>
                </div>
                <p className="text-[11px] theme-text-muted leading-relaxed">
                  Auto-detected calendar meetings, deliverables, and waiting follow-up reminders.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Sign In Card */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="theme-card p-5 sm:p-7 rounded-3xl border theme-border shadow-xl space-y-4 sm:space-y-5">
              {/* Header */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 shadow-md shadow-brand-500/20 mb-1">
                  <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight theme-text-main">
                  Sign in with Google
                </h2>
                <p className="text-xs theme-text-muted max-w-xs mx-auto leading-relaxed">
                  Connect your Gmail account to access your AI productivity assistant.
                </p>
              </div>

              {/* Error Notice */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs flex items-start gap-2 shadow-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{errorMessage}</div>
                </div>
              )}

              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={loginWithGoogle}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 sm:px-5 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs shadow-md border border-slate-200 transition-all hover:scale-[1.01] active:scale-[0.99] group cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* Security Points */}
              <div className="pt-3 border-t theme-border space-y-2 text-[11px] theme-text-muted">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Direct Google OAuth 2.0 security</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Encrypted session tokens &amp; HTTP-only cookies</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Zero password storage guarantee</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="theme-header border-t theme-border py-3 px-4 sm:px-6 text-center text-xs theme-text-muted flex flex-col sm:flex-row items-center justify-between gap-2 z-20">
        <div>© 2026 Intelligent Email Assistant. All rights reserved.</div>
        <div className="flex items-center gap-3 sm:gap-4 text-[11px]">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-brand-500" /> Powered by Gemini
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-500" /> Google OAuth Verified
          </span>
        </div>
      </footer>
    </div>
  );
}

export default Login;
