import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  CheckCircle2,
  ExternalLink,
  Edit3,
  X,
  Plus,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import { EditMeetingModal } from './EditMeetingModal';

export function MeetingDetectionCard({ threadId, onEventCreated }) {
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createdEvent, setCreatedEvent] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);

  // Automatically detect meeting proposal on thread load
  const fetchMeetingProposal = useCallback(async () => {
    if (!threadId) return;
    try {
      setLoading(true);
      setErrorInfo(null);
      const res = await api.post(`/calendar/detect/${threadId}`);
      if (res.data?.success && res.data.proposal?.isMeetingDetected) {
        setProposal(res.data.proposal);
        if (res.data.proposal.alreadyCreated && res.data.proposal.existingEvent) {
          setCreatedEvent(res.data.proposal.existingEvent);
        }
      } else {
        setProposal(null);
      }
    } catch (err) {
      console.warn('[MeetingDetection] Failed to detect meeting:', err.message);
      setProposal(null);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchMeetingProposal();
  }, [fetchMeetingProposal]);

  const handleCreateEvent = async (eventPayload = proposal) => {
    if (!eventPayload || isCreating) return;

    try {
      setIsCreating(true);
      setErrorInfo(null);

      // Validate required startDateTime
      let startDateTime = eventPayload.startDateTime;
      let endDateTime = eventPayload.endDateTime;

      if (!startDateTime && eventPayload.date && eventPayload.startTime) {
        startDateTime = `${eventPayload.date}T${eventPayload.startTime}:00`;
      }

      if (!startDateTime) {
        // If date/time was ambiguous, prompt user to edit
        setShowEditModal(true);
        setIsCreating(false);
        return;
      }

      const res = await api.post('/calendar/events', {
        title: eventPayload.title,
        description: eventPayload.description,
        location: eventPayload.location || eventPayload.meetingLink,
        startDateTime,
        endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        attendees: eventPayload.attendees,
        emailId: eventPayload.emailId
      });

      if (res.data?.success) {
        setCreatedEvent({
          eventId: res.data.eventId,
          htmlLink: res.data.htmlLink,
          summary: res.data.summary,
          startDateTime: res.data.startDateTime,
          endDateTime: res.data.endDateTime
        });
        setShowEditModal(false);
        if (onEventCreated) onEventCreated(res.data);
      }
    } catch (err) {
      console.error('[MeetingDetection] Failed to create event:', err);
      const data = err.response?.data;
      if (err.response?.status === 403 && data?.requiresReauth) {
        setErrorInfo({
          type: 'AUTH',
          message: data.message || 'Google Calendar permission required.'
        });
      } else if (data?.isApiDisabled) {
        setErrorInfo({
          type: 'API_DISABLED',
          message: data.message
        });
      } else {
        setErrorInfo({
          type: 'GENERAL',
          message: data?.message || err.message || 'Failed to create calendar event.'
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  // If dismissed or no meeting detected and not loading, render nothing
  if (isDismissed || (!loading && !proposal)) {
    return null;
  }

  // Loading shimmer state
  if (loading) {
    return (
      <div className="p-4 rounded-2xl border theme-border theme-card animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl theme-input"></div>
          <div className="space-y-1.5">
            <div className="h-3.5 theme-input rounded w-40"></div>
            <div className="h-2.5 theme-input rounded w-60"></div>
          </div>
        </div>
        <div className="h-7 theme-input rounded-lg w-24"></div>
      </div>
    );
  }

  // State A: Event Already Created on Google Calendar
  if (createdEvent) {
    const formattedDate = createdEvent.startDateTime
      ? new Date(createdEvent.startDateTime).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : '';

    return (
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs flex items-center gap-1.5 flex-wrap">
              <span>Added to Google Calendar</span>
              {formattedDate && <span className="opacity-80 font-normal truncate">• {formattedDate}</span>}
            </div>
            <div className="text-xs opacity-90 font-medium truncate">
              {createdEvent.summary || proposal.title}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {createdEvent.htmlLink && (
            <a
              href={createdEvent.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>View in Calendar</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-emerald-500/20 transition-all cursor-pointer"
            title="Dismiss"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Format proposed date/time for display
  let formattedTimeDisplay = '';
  if (proposal.date) {
    const d = new Date(proposal.date + 'T00:00:00');
    const dateStr = !isNaN(d.getTime())
      ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      : proposal.date;

    if (proposal.startTime) {
      formattedTimeDisplay = `${dateStr} at ${proposal.startTime}`;
      if (proposal.endTime) {
        formattedTimeDisplay += ` – ${proposal.endTime}`;
      }
    } else {
      formattedTimeDisplay = `${dateStr} (Time to be decided)`;
    }
  } else {
    formattedTimeDisplay = 'Date and time need confirmation';
  }

  return (
    <>
      <div className="p-4 sm:p-5 rounded-2xl theme-card border border-brand-500/30 bg-gradient-to-r from-brand-500/5 via-transparent to-brand-500/5 transition-all space-y-3.5 shadow-md w-full min-w-0">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold theme-text-main text-xs flex items-center gap-1.5 flex-wrap">
                <span>Meeting Detected</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shrink-0">
                  AI Suggestion
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-lg theme-text-muted hover:theme-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
            title="Dismiss suggestion"
            aria-label="Dismiss suggestion"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meeting Content Details */}
        <div className="space-y-2 pl-0 sm:pl-9 min-w-0">
          <div className="text-xs sm:text-sm font-bold theme-text-main break-words">{proposal.title}</div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs theme-text-muted">
            <div className="flex items-center gap-1 font-medium theme-text-main">
              <Clock className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span>{formattedTimeDisplay}</span>
            </div>

            {proposal.location && (
              <div className="flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span className="truncate max-w-[160px] sm:max-w-xs">{proposal.location}</span>
              </div>
            )}

            {proposal.meetingLink && (
              <div className="flex items-center gap-1 font-medium text-brand-600 dark:text-brand-400">
                <Video className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[160px] sm:max-w-xs">{proposal.meetingLink}</span>
              </div>
            )}
          </div>

          {proposal.description && (
            <div className="text-xs theme-text-muted leading-relaxed opacity-90 break-words">
              {proposal.description}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t theme-border">
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="px-3 py-1.5 rounded-xl theme-card border theme-border hover:opacity-80 text-xs font-semibold theme-text-muted hover:theme-text-main transition-all cursor-pointer"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="px-3 py-1.5 rounded-xl theme-card border theme-border hover:border-brand-500/40 text-xs font-semibold theme-text-main transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3 h-3 text-brand-500" />
            <span>Edit Details</span>
          </button>
          <button
            type="button"
            onClick={() => handleCreateEvent()}
            disabled={isCreating}
            className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isCreating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>{isCreating ? 'Adding...' : 'Add to Calendar'}</span>
          </button>
        </div>
      </div>

      {/* Edit Details Modal */}
      <EditMeetingModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        proposal={proposal}
        onConfirm={handleCreateEvent}
        isCreating={isCreating}
      />
    </>
  );
}

export default MeetingDetectionCard;
