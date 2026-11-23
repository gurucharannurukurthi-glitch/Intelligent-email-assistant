import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Edit3,
  X,
  Plus,
  RefreshCw,
  ListTodo
} from 'lucide-react';
import api from '../services/api';
import { EditTaskModal } from './EditTaskModal';

export function TaskDetectionCard({ threadId, onTaskCreated }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingIndex, setCreatingIndex] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchTaskProposals = useCallback(async () => {
    if (!threadId) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await api.post(`/tasks/detect/${threadId}`);
      if (res.data?.success && res.data.data?.hasTasks && Array.isArray(res.data.data.tasks)) {
        setTasks(res.data.data.tasks);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.warn('[TaskDetection] Failed to detect tasks:', err.message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchTaskProposals();
  }, [fetchTaskProposals]);

  const handleCreateTask = async (taskPayload, index) => {
    if (!taskPayload || creatingIndex !== null) return;

    try {
      setCreatingIndex(index);
      setErrorMessage(null);

      const res = await api.post('/tasks', {
        title: taskPayload.title,
        description: taskPayload.description,
        dueDate: taskPayload.dueDate || null,
        sourceEmailId: taskPayload.sourceEmailId,
        sourceThreadId: taskPayload.sourceThreadId,
        sourceSubject: taskPayload.sourceSubject,
        sourceSender: taskPayload.sourceSender
      });

      if (res.data?.success) {
        setTasks((prev) =>
          prev.map((t, idx) =>
            idx === index
              ? {
                  ...t,
                  alreadyCreated: true,
                  existingTaskId: res.data.task?._id,
                  existingStatus: res.data.task?.status || 'pending'
                }
              : t
          )
        );
        setEditingTask(null);
        if (onTaskCreated) onTaskCreated(res.data.task);
      }
    } catch (err) {
      console.error('[TaskDetection] Failed to create task:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to create task.');
    } finally {
      setCreatingIndex(null);
    }
  };

  const handleDismissTask = (index) => {
    setTasks((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (updated.length === 0) {
        setIsDismissed(true);
      }
      return updated;
    });
  };

  const handleEditModalSave = (updatedTask) => {
    if (editingIndex !== null) {
      handleCreateTask(updatedTask, editingIndex);
    }
  };

  if (isDismissed || (!loading && tasks.length === 0)) {
    return null;
  }

  if (loading) {
    return (
      <div className="p-4 rounded-2xl border theme-border theme-card animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl theme-input"></div>
          <div className="space-y-1.5">
            <div className="h-3.5 theme-input rounded w-44"></div>
            <div className="h-2.5 theme-input rounded w-64"></div>
          </div>
        </div>
        <div className="h-7 theme-input rounded-lg w-24"></div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-5 rounded-2xl theme-card border border-brand-500/30 bg-gradient-to-r from-brand-500/5 via-transparent to-brand-500/5 transition-all space-y-3.5 shadow-md w-full min-w-0">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 border-b theme-border pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shrink-0">
              <ListTodo className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold theme-text-main text-xs flex items-center gap-1.5 flex-wrap">
                <span>Action Items Detected</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shrink-0">
                  {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'} Suggested
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-lg theme-text-muted hover:theme-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
            title="Dismiss all task suggestions"
            aria-label="Dismiss all task suggestions"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-2.5 text-xs text-red-600 bg-red-500/10 border border-red-500/20 rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* Task Items List */}
        <div className="space-y-2.5">
          {tasks.map((task, idx) => {
            const formattedDueDate = task.dueDate
              ? new Date(task.dueDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                })
              : null;

            return (
              <div
                key={idx}
                className="p-3 sm:p-3.5 rounded-xl theme-card border theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all shadow-sm"
              >
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
                    <p className="text-xs theme-text-muted line-clamp-2 leading-relaxed break-words">
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Individual Task Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {task.alreadyCreated ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Added
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTask(task);
                          setEditingIndex(idx);
                        }}
                        className="p-1.5 rounded-lg theme-card border theme-border hover:border-brand-500/40 text-xs text-brand-500 transition-colors cursor-pointer"
                        title="Edit Task Details"
                        aria-label="Edit Task Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCreateTask(task, idx)}
                        disabled={creatingIndex !== null}
                        className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        {creatingIndex === idx ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                        <span>Create Task</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDismissTask(idx)}
                        className="p-1.5 rounded-lg opacity-60 hover:opacity-100 theme-text-muted hover:theme-text-main transition-colors cursor-pointer"
                        title="Dismiss"
                        aria-label="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Task Modal */}
      <EditTaskModal
        isOpen={Boolean(editingTask)}
        onClose={() => {
          setEditingTask(null);
          setEditingIndex(null);
        }}
        task={editingTask}
        onConfirm={handleEditModalSave}
        isSaving={creatingIndex !== null}
      />
    </>
  );
}

export default TaskDetectionCard;
