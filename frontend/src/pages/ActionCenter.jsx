import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { EditTaskModal } from '../components/EditTaskModal';
import { FollowUpModal } from '../components/FollowUpModal';
import { ActionCenterSkeleton } from '../components/LoadingSkeleton';
import {
  ListTodo,
  CheckCircle2,
  Circle,
  Calendar,
  ExternalLink,
  Edit3,
  Trash2,
  AlertCircle,
  RefreshCw,
  Clock,
  Send,
  BellRing,
  CheckSquare
} from 'lucide-react';
import api from '../services/api';

export function ActionCenter() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluatingFollowUps, setEvaluatingFollowUps] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'followups' | 'completed'
  const [editingTask, setEditingTask] = useState(null);
  const [activeFollowUp, setActiveFollowUp] = useState(null);
  const [draftData, setDraftData] = useState(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFollowUpsStale, setIsFollowUpsStale] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tasksRes, followUpsRes] = await Promise.allSettled([
        api.get('/tasks'),
        api.get('/follow-ups')
      ]);

      if (tasksRes.status === 'fulfilled' && tasksRes.value.data?.success) {
        setTasks(tasksRes.value.data.tasks || []);
      }
      if (followUpsRes.status === 'fulfilled' && followUpsRes.value.data?.success) {
        setFollowUps(followUpsRes.value.data.followUps || []);
        setIsFollowUpsStale(false);
      }
    } catch (err) {
      console.error('Failed to fetch action center data:', err);
      setError(err.response?.data?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEvaluateFollowUps = async () => {
    try {
      setEvaluatingFollowUps(true);
      setError(null);
      const res = await api.post('/follow-ups/evaluate', { minWaitingDays: 3, maxWaitingDays: 30 });
      if (res.data?.success) {
        setFollowUps(res.data.followUps || []);
        setIsFollowUpsStale(false);
        setSuccessMessage('Scan complete: Actionable follow-ups updated.');
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch (err) {
      console.error('Failed to evaluate follow-ups:', err);
      const errMsg = err.response?.data?.message || err.message || 'Server error occurred during scan.';
      setError(`Evaluation failed: ${errMsg}`);
      setIsFollowUpsStale(true);
    } finally {
      setEvaluatingFollowUps(false);
    }
  };

  const handleOpenFollowUpDraft = async (fu) => {
    try {
      setActiveFollowUp(fu);
      setIsDrafting(true);
      setError(null);
      const res = await api.post(`/follow-ups/${fu._id}/draft`);
      if (res.data?.success) {
        setDraftData(res.data.draft);
      }
    } catch (err) {
      console.error('Failed to generate draft:', err);
      setError(err.response?.data?.message || 'Failed to generate follow-up draft.');
      setActiveFollowUp(null);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSendFollowUp = async ({ followUpId, subject, messageText }) => {
    try {
      setIsSendingFollowUp(true);
      setError(null);
      const res = await api.post(`/follow-ups/${followUpId}/send`, {
        subject,
        messageText
      });

      if (res.data?.success) {
        setSuccessMessage('Follow-up sent successfully via Gmail.');
        setFollowUps((prev) => prev.filter((f) => f._id !== followUpId));
        setActiveFollowUp(null);
        setDraftData(null);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err) {
      console.error('Failed to send follow-up:', err);
      setError(err.response?.data?.message || 'Failed to send follow-up email.');
    } finally {
      setIsSendingFollowUp(false);
    }
  };

  const handleDismissFollowUp = async (followUpId) => {
    setFollowUps((prev) => prev.filter((f) => f._id !== followUpId));
    try {
      await api.post(`/follow-ups/${followUpId}/dismiss`);
    } catch (err) {
      console.error('Failed to dismiss follow-up:', err);
      fetchData();
    }
  };

  const handleToggleStatus = async (taskId, currentStatus) => {
    const targetStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t._id === taskId
          ? { ...t, status: targetStatus, completedAt: targetStatus === 'completed' ? new Date() : null }
          : t
      )
    );

    try {
      await api.patch(`/tasks/${taskId}/status`, { status: targetStatus });
    } catch (err) {
      console.error('Failed to toggle task status:', err);
      fetchData();
    }
  };

  const handleDeleteTask = async (taskId) => {
    // Optimistic UI update
    setTasks((prev) => prev.filter((t) => t._id !== taskId));

    try {
      await api.delete(`/tasks/${taskId}`);
    } catch (err) {
      console.error('Failed to delete task:', err);
      fetchData();
    }
  };

  const handleEditSave = async (updatedTask) => {
    try {
      setIsSaving(true);
      const res = await api.patch(`/tasks/${updatedTask._id}`, {
        title: updatedTask.title,
        description: updatedTask.description,
        dueDate: updatedTask.dueDate
      });

      if (res.data?.success) {
        setTasks((prev) =>
          prev.map((t) => (t._id === updatedTask._id ? res.data.task : t))
        );
        setEditingTask(null);
      }
    } catch (err) {
      console.error('Failed to save task edits:', err);
      setError(err.response?.data?.message || 'Failed to update task.');
    } finally {
      setIsSaving(false);
    }
  };

  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="theme-app-bg min-h-screen flex flex-col transition-colors">
      <Navbar />

      <div className="flex-1 flex min-h-0">
        <Sidebar currentFolder="ACTION_CENTER" onSelectFolder={() => navigate('/dashboard')} />

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-5 max-w-5xl mx-auto w-full min-w-0">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b theme-border">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  <ListTodo className="w-5 h-5" />
                </div>
                <h1 className="text-lg sm:text-xl font-bold theme-text-main tracking-tight">Action Center</h1>
              </div>
              <p className="text-xs theme-text-muted mt-1">
                Things that need your attention — tasks, deliverables, and waiting follow-ups.
              </p>
            </div>

            {/* Statistics Badges */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs flex-wrap">
              <span className="px-2.5 py-1 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold border border-brand-500/20">
                {pendingTasks.length} {pendingTasks.length === 1 ? 'Task' : 'Tasks'}
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20 flex items-center gap-1">
                <BellRing className="w-3 h-3" />
                {followUps.length} Follow-ups
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                {completedTasks.length} Done
              </span>
            </div>
          </div>

          {/* Success Alert */}
          {successMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 text-xs rounded-xl flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="font-bold underline ml-2 cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          {/* Navigation Tabs - Horizontal Scroll on Mobile */}
          <div className="flex items-center justify-between border-b theme-border pb-1 gap-2 overflow-x-auto">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'theme-text-muted hover:theme-text-main hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span>Tasks</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === 'pending'
                      ? 'bg-white/20 text-white'
                      : 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                  }`}
                >
                  {pendingTasks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('followups')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'followups'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'theme-text-muted hover:theme-text-main hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Follow-ups</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === 'followups'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                  }`}
                >
                  {followUps.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'completed'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'theme-text-muted hover:theme-text-main hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span>Completed</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    activeTab === 'completed'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                  }`}
                >
                  {completedTasks.length}
                </span>
              </button>
            </div>

            {activeTab === 'followups' && (
              <button
                type="button"
                onClick={handleEvaluateFollowUps}
                disabled={evaluatingFollowUps}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl theme-card border theme-border hover:border-amber-500/40 active:scale-[0.98] text-xs font-semibold theme-text-main transition-all flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                title="Scan sent emails for unanswered requests"
              >
                <RefreshCw className={`w-3 h-3 text-amber-500 ${evaluatingFollowUps ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{evaluatingFollowUps ? 'Scanning...' : 'Scan Sent Mail'}</span>
                <span className="sm:hidden">{evaluatingFollowUps ? 'Scanning...' : 'Scan'}</span>
              </button>
            )}
          </div>

          {/* Loading Skeleton */}
          {loading && <ActionCenterSkeleton />}

          {/* FOLLOW-UPS TAB CONTENT */}
          {!loading && activeTab === 'followups' && (
            <div className="space-y-3">
              {/* Stale Data Warning Banner */}
              {isFollowUpsStale && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Showing previously loaded follow-ups. The latest scan could not be completed.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleEvaluateFollowUps}
                    disabled={evaluatingFollowUps}
                    className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 transition-all cursor-pointer"
                  >
                    {evaluatingFollowUps ? 'Retrying...' : 'Retry Scan'}
                  </button>
                </div>
              )}

              {followUps.length === 0 ? (
                <div className="p-8 sm:p-12 text-center theme-card border theme-border rounded-2xl space-y-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold theme-text-main">
                    You're all caught up!
                  </div>
                  <div className="text-xs theme-text-muted max-w-sm mx-auto">
                    When you send emails with requests that haven't received a response between 3 and 30 days, actionable follow-ups appear here.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {followUps.map((fu) => {
                    const recipientName = fu.recipient?.name
                      ? `${fu.recipient.name} <${fu.recipient.email}>`
                      : fu.recipient?.email || '';

                    const sentFormatted = new Date(fu.sentAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <div
                        key={fu._id}
                        className="p-3.5 sm:p-4 rounded-2xl theme-card border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shadow-sm hover:border-amber-500/50 group w-full min-w-0"
                      >
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs theme-text-main truncate">
                              {fu.subject || '(No Subject)'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              Waiting {fu.waitingDays} {fu.waitingDays === 1 ? 'day' : 'days'}
                            </span>
                          </div>

                          <div className="text-xs theme-text-muted flex items-center gap-2 flex-wrap">
                            <span className="truncate">To: <strong className="theme-text-main">{recipientName}</strong></span>
                            <span>•</span>
                            <span className="shrink-0">Sent on {sentFormatted}</span>
                          </div>

                          {/* AI Reason Context */}
                          <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border theme-border text-xs theme-text-muted leading-relaxed break-words">
                            <span className="font-semibold theme-text-main">AI Context: </span>
                            {fu.reason}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <button
                            type="button"
                            onClick={() => handleDismissFollowUp(fu._id)}
                            className="px-3 py-1.5 rounded-xl theme-card border theme-border hover:opacity-80 text-xs font-semibold theme-text-muted hover:theme-text-main transition-all cursor-pointer"
                          >
                            Dismiss
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenFollowUpDraft(fu)}
                            disabled={isDrafting}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-semibold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Draft Follow-up</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PENDING TASKS TAB CONTENT */}
          {!loading && activeTab === 'pending' && (
            <div className="space-y-3">
              {pendingTasks.length === 0 ? (
                <div className="p-8 sm:p-12 text-center theme-card border theme-border rounded-2xl space-y-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-500 mx-auto flex items-center justify-center">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold theme-text-main">No pending tasks</div>
                  <div className="text-xs theme-text-muted max-w-sm mx-auto">
                    Action items detected from your email threads will appear here for easy tracking.
                  </div>
                </div>
              ) : (
                pendingTasks.map((task) => {
                  const formattedDueDate = task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : null;

                  return (
                    <div
                      key={task._id}
                      className="p-3.5 sm:p-4 rounded-2xl theme-card border theme-border hover:border-brand-500/40 transition-all flex items-start justify-between gap-3 sm:gap-4 shadow-sm group w-full min-w-0"
                    >
                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                        {/* Status Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(task._id, task.status)}
                          className="mt-0.5 text-slate-400 hover:text-emerald-500 transition-colors shrink-0 cursor-pointer"
                          title="Mark as completed"
                          aria-label="Mark as completed"
                        >
                          <Circle className="w-5 h-5 hover:fill-emerald-500/10" />
                        </button>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-xs theme-text-main break-words">
                              {task.title}
                            </span>
                            {formattedDueDate && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center gap-1 shrink-0">
                                <Calendar className="w-3 h-3" />
                                {formattedDueDate}
                              </span>
                            )}
                          </div>

                          {task.description && (
                            <p className="text-xs theme-text-muted leading-relaxed break-words">
                              {task.description}
                            </p>
                          )}

                          {/* Source Thread link */}
                          {task.sourceSubject && task.sourceThreadId && (
                            <div className="pt-0.5 flex items-center gap-1 text-[11px] theme-text-muted">
                              <span>Source:</span>
                              <Link
                                to={`/thread/${task.sourceThreadId}`}
                                className="font-medium text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 truncate max-w-[160px] sm:max-w-md"
                              >
                                <span className="truncate">{task.sourceSubject}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Task Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingTask(task)}
                          className="p-2 sm:p-1.5 rounded-lg theme-card border theme-border hover:border-brand-500/40 text-xs text-brand-500 transition-colors cursor-pointer"
                          title="Edit Task"
                          aria-label="Edit Task"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task._id)}
                          className="p-2 sm:p-1.5 rounded-lg theme-card border theme-border hover:text-red-500 text-xs theme-text-muted transition-colors cursor-pointer"
                          title="Delete Task"
                          aria-label="Delete Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* COMPLETED TASKS TAB CONTENT */}
          {!loading && activeTab === 'completed' && (
            <div className="space-y-3">
              {completedTasks.length === 0 ? (
                <div className="p-8 sm:p-12 text-center theme-card border theme-border rounded-2xl space-y-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold theme-text-main">No completed tasks yet</div>
                  <div className="text-xs theme-text-muted max-w-sm mx-auto">
                    When you complete tasks, they will be archived here for your records.
                  </div>
                </div>
              ) : (
                completedTasks.map((task) => (
                  <div
                    key={task._id}
                    className="p-3.5 sm:p-4 rounded-2xl theme-card border theme-border opacity-75 hover:opacity-100 transition-all flex items-center justify-between gap-3 sm:gap-4 shadow-sm w-full min-w-0"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(task._id, task.status)}
                        className="text-emerald-500 hover:text-slate-400 transition-colors shrink-0 cursor-pointer"
                        title="Mark as pending"
                        aria-label="Mark as pending"
                      >
                        <CheckCircle2 className="w-5 h-5 fill-emerald-500/20" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-xs theme-text-muted line-through truncate block">
                          {task.title}
                        </span>
                        {task.sourceSubject && (
                          <span className="text-[11px] theme-text-muted opacity-70 block truncate">
                            Source: {task.sourceSubject}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task._id)}
                      className="p-1.5 rounded-lg theme-card border theme-border hover:text-red-500 text-xs theme-text-muted shrink-0 cursor-pointer"
                      title="Delete Task"
                      aria-label="Delete Task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* Edit Task Modal */}
      <EditTaskModal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        task={editingTask}
        onConfirm={handleEditSave}
        isSaving={isSaving}
      />

      {/* Follow-up Draft & Send Modal */}
      <FollowUpModal
        isOpen={Boolean(activeFollowUp)}
        onClose={() => {
          setActiveFollowUp(null);
          setDraftData(null);
        }}
        followUp={activeFollowUp}
        draftData={draftData}
        isDrafting={isDrafting}
        isSending={isSendingFollowUp}
        onSend={handleSendFollowUp}
      />
    </div>
  );
}

export default ActionCenter;
