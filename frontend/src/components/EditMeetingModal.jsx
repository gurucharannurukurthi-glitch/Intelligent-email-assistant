import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, AlignLeft, Check } from 'lucide-react';

export function EditMeetingModal({ isOpen, onClose, proposal, onConfirm, isCreating }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (proposal) {
      setTitle(proposal.title || '');
      setDate(proposal.date || new Date().toISOString().slice(0, 10));
      setStartTime(proposal.startTime || '10:00');
      setEndTime(proposal.endTime || '11:00');
      setLocation(proposal.location || proposal.meetingLink || '');
      setDescription(proposal.description || '');
    }
  }, [proposal]);

  // Accessibility: Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !proposal) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !date || !startTime) return;

    const startDateTime = `${date}T${startTime}:00`;
    let endDateTime = null;
    if (endTime) {
      endDateTime = `${date}T${endTime}:00`;
    }

    onConfirm({
      title: title.trim(),
      date,
      startTime,
      endTime,
      startDateTime,
      endDateTime,
      location: location.trim(),
      description: description.trim(),
      attendees: proposal.attendees || [],
      emailId: proposal.emailId
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="theme-card border theme-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b theme-border bg-brand-500/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-bold theme-text-main text-sm sm:text-base">Edit Event Details</h3>
              <p className="text-[11px] sm:text-xs theme-text-muted">Review before adding to Google Calendar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg theme-text-muted hover:theme-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1">
          {/* Title */}
          <div className="space-y-1">
            <label className="font-bold theme-text-main block">Event Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Project Discussion"
              className="w-full px-3 py-2 rounded-xl theme-card border theme-border focus:outline-none focus:ring-2 focus:ring-brand-500/30 theme-text-main text-xs"
            />
          </div>

          {/* Date & Times */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="font-bold theme-text-main flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-brand-500" /> Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-xl theme-card border theme-border focus:outline-none focus:ring-2 focus:ring-brand-500/30 theme-text-main text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold theme-text-main flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-brand-500" /> Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-xl theme-card border theme-border focus:outline-none focus:ring-2 focus:ring-brand-500/30 theme-text-main text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold theme-text-main flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-brand-500" /> End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl theme-card border theme-border focus:outline-none focus:ring-2 focus:ring-brand-500/30 theme-text-main text-xs"
              />
            </div>
          </div>

          {/* Location / Meeting Link */}
          <div className="space-y-1">
            <label className="font-bold theme-text-main flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-brand-500" /> Location or Meeting Link
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Google Meet URL or Room 204"
              className="w-full px-3 py-2 rounded-xl theme-card border theme-border focus:outline-none focus:ring-2 focus:ring-brand-500/30 theme-text-main text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="font-bold theme-text-main flex items-center gap-1">
              <AlignLeft className="w-3.5 h-3.5 text-brand-500" /> Description / Context
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting agenda and context..."
              className="w-full px-3 py-2 rounded-xl theme-card border theme-border focus:outline-none focus:ring-2 focus:ring-brand-500/30 theme-text-main text-xs resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t theme-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl theme-input hover:opacity-80 text-xs font-semibold theme-text-main transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !title.trim() || !date || !startTime}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isCreating ? 'Adding...' : 'Add to Calendar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditMeetingModal;
