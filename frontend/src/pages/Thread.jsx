import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { EmailDetail } from '../components/EmailDetail';
import { AISummaryCard } from '../components/AISummaryCard';
import { MeetingDetectionCard } from '../components/MeetingDetectionCard';
import { TaskDetectionCard } from '../components/TaskDetectionCard';
import { ReplyDraftPanel } from '../components/ReplyDraftPanel';
import { ThreadSkeleton } from '../components/LoadingSkeleton';
import { ArrowLeft, Star, Archive, Trash2, Mail, MailOpen } from 'lucide-react';
import api from '../services/api';

export function Thread() {
  const { threadId } = useParams();
  const navigate = useNavigate();

  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [isCachedSummary, setIsCachedSummary] = useState(false);
  const [error, setError] = useState(null);

  const fetchThread = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/emails/${threadId}`);
      const threadMessages = res.data.emails || [];
      setEmails(threadMessages);

      const existingSummary = threadMessages.find((e) => e.aiSummary)?.aiSummary;
      if (existingSummary) {
        setSummary(existingSummary);
        setIsCachedSummary(true);
      }
    } catch (err) {
      console.error('Error fetching thread:', err);
      setError(err.response?.data?.message || 'Failed to load email thread.');
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  const handleGenerateSummary = async () => {
    if (emails.length === 0) return;
    const targetEmailId = emails[0]._id;

    try {
      setIsSummarizing(true);
      setError(null);
      const res = await api.post(`/ai/summarize/${targetEmailId}`);
      setSummary(res.data.summary);
      setIsCachedSummary(res.data.cached || false);
    } catch (err) {
      console.error('Error generating summary:', err);
      setError(err.response?.data?.message || 'Failed to generate AI summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleToggleStar = async (targetEmail) => {
    const newStarred = !targetEmail.isStarred;
    setEmails((prev) =>
      prev.map((e) => (e._id === targetEmail._id ? { ...e, isStarred: newStarred } : e))
    );
    try {
      await api.patch(`/emails/${targetEmail._id}`, { isStarred: newStarred });
    } catch (err) {
      setEmails((prev) =>
        prev.map((e) => (e._id === targetEmail._id ? { ...e, isStarred: !newStarred } : e))
      );
    }
  };

  const handleToggleRead = async (targetEmail) => {
    const newRead = !targetEmail.isRead;
    setEmails((prev) =>
      prev.map((e) => (e._id === targetEmail._id ? { ...e, isRead: newRead } : e))
    );
    try {
      await api.patch(`/emails/${targetEmail._id}`, { isRead: newRead });
    } catch (err) {
      setEmails((prev) =>
        prev.map((e) => (e._id === targetEmail._id ? { ...e, isRead: !newRead } : e))
      );
    }
  };

  const handleArchive = async (targetEmail) => {
    try {
      await api.patch(`/emails/${targetEmail._id}`, { isArchived: true });
      navigate('/dashboard');
    } catch (err) {
      console.error('Error archiving email:', err);
    }
  };

  const handleDelete = async (targetEmail) => {
    try {
      if (threadId) {
        await api.delete(`/emails/thread/${threadId}`);
      } else if (targetEmail?._id) {
        await api.delete(`/emails/${targetEmail._id}`);
      }
      navigate('/dashboard');
    } catch (err) {
      console.error('Error deleting thread:', err);
    }
  };

  const latestEmail = emails.length > 0 ? emails[emails.length - 1] : null;
  const firstEmail = emails.length > 0 ? emails[0] : null;
  const threadSubject = firstEmail?.subject || '(No Subject)';

  return (
    <div className="theme-app-bg min-h-screen flex flex-col transition-colors">
      <Navbar />

      <div className="flex-1 flex min-h-0">
        <Sidebar currentFolder="INBOX" onSelectFolder={() => navigate('/dashboard')} />

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-4 max-w-5xl mx-auto w-full min-w-0">
          {/* Thread Header Toolbar */}
          <div className="flex items-center justify-between gap-2.5 pb-3 border-b theme-border">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="p-1.5 rounded-xl theme-card border theme-border hover:opacity-80 active:scale-95 transition-all shrink-0 cursor-pointer"
                title="Back to inbox"
                aria-label="Back to inbox"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-sm sm:text-base md:text-lg font-bold theme-text-main truncate">
                {threadSubject}
              </h2>
            </div>

            {firstEmail && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleStar(firstEmail)}
                  className="p-1.5 rounded-lg theme-card border theme-border hover:text-amber-500 active:scale-95 transition-all cursor-pointer"
                  title={firstEmail.isStarred ? 'Unstar thread' : 'Star thread'}
                  aria-label={firstEmail.isStarred ? 'Unstar thread' : 'Star thread'}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      firstEmail.isStarred ? 'text-amber-400 fill-amber-400' : ''
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleRead(firstEmail)}
                  className="p-1.5 rounded-lg theme-card border theme-border hover:opacity-80 active:scale-95 transition-all cursor-pointer"
                  title={firstEmail.isRead ? 'Mark unread' : 'Mark read'}
                  aria-label={firstEmail.isRead ? 'Mark unread' : 'Mark read'}
                >
                  {firstEmail.isRead ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleArchive(firstEmail)}
                  className="p-1.5 rounded-lg theme-card border theme-border hover:opacity-80 active:scale-95 transition-all cursor-pointer"
                  title="Archive thread"
                  aria-label="Archive thread"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(firstEmail)}
                  className="p-1.5 rounded-lg theme-card border theme-border hover:text-red-500 active:scale-95 transition-all cursor-pointer"
                  title="Delete thread"
                  aria-label="Delete thread"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 text-xs rounded-xl shadow-sm">
              {error}
            </div>
          )}

          {loading ? (
            <ThreadSkeleton />
          ) : (
            <>
              {/* AI Summarize Card */}
              <AISummaryCard
                summary={summary}
                isSummarizing={isSummarizing}
                onGenerateSummary={handleGenerateSummary}
                isCached={isCachedSummary}
              />

              {/* V3.1 Email -> Google Calendar Meeting Detection Card */}
              <MeetingDetectionCard threadId={threadId} onEventCreated={fetchThread} />

              {/* V3.2 Email -> Task Manager Action Detection Card */}
              <TaskDetectionCard threadId={threadId} onTaskCreated={fetchThread} />

              {/* Messages Stack */}
              <div className="space-y-3">
                {emails.map((email, index) => (
                  <EmailDetail
                    key={email._id || email.messageId}
                    email={email}
                    isLatest={index === emails.length - 1}
                    onToggleStar={handleToggleStar}
                    onToggleRead={handleToggleRead}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                  />
                ))}
              </div>

              {/* AI Reply Draft Panel */}
              {latestEmail && (
                <div className="pt-1">
                  <ReplyDraftPanel
                    emailId={latestEmail._id}
                    replyTo={latestEmail.sender?.email || ''}
                    replySubject={threadSubject}
                    threadId={threadId}
                    onReplySent={fetchThread}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Thread;
