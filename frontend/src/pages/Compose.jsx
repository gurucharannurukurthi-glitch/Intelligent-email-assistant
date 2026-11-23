import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { RecipientAutocomplete } from '../components/RecipientAutocomplete';
import { Send, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export function Compose() {
  const navigate = useNavigate();

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!to.trim() || !messageText.trim()) {
      setError('Please provide a recipient and message body.');
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      await api.post('/emails/send', {
        to: to.trim(),
        subject: subject.trim(),
        messageText: messageText.trim()
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      console.error('Error sending email:', err);
      setError(err.response?.data?.message || 'Failed to send email via Gmail API.');
      setIsSending(false);
    }
  };

  return (
    <div className="theme-app-bg min-h-screen flex flex-col transition-colors">
      <Navbar />

      <div className="flex-1 flex min-h-0">
        <Sidebar currentFolder="INBOX" onSelectFolder={() => navigate('/dashboard')} />

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 max-w-4xl mx-auto w-full min-w-0">
          <div className="space-y-4 sm:space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b theme-border">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="p-2 sm:p-1.5 rounded-xl theme-card border theme-border hover:opacity-80 transition-colors cursor-pointer"
                  title="Back to inbox"
                  aria-label="Back to inbox"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base sm:text-lg font-bold theme-text-main">New Message</h2>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 text-xs rounded-xl">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Email sent successfully! Redirecting to inbox...</span>
              </div>
            )}

            {/* Compose Form */}
            <form onSubmit={handleSend} className="theme-card p-4 sm:p-5 rounded-2xl border theme-border space-y-3.5 shadow-sm w-full min-w-0">
              <div className="space-y-1">
                <label className="text-[11px] font-bold theme-text-muted uppercase tracking-wider">
                  To (Recipient)
                </label>
                <RecipientAutocomplete
                  required
                  value={to}
                  onChange={(val) => setTo(val)}
                  placeholder="Type name or email address..."
                  className="theme-input w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border theme-border focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold theme-text-muted uppercase tracking-wider">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className="theme-input w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border theme-border focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold theme-text-muted uppercase tracking-wider">
                  Message
                </label>
                <textarea
                  required
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Write your email here..."
                  rows={9}
                  className="theme-input w-full p-3.5 text-xs sm:text-sm rounded-xl border theme-border focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 font-sans leading-relaxed resize-y max-w-full"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t theme-border">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="px-3.5 py-2 text-xs font-semibold theme-text-muted hover:theme-text-main transition-colors text-center cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSending || success}
                  className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 rounded-xl shadow-md shadow-brand-500/20 transition-all cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Compose;
