import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const NotificationContext = createContext(null);

// Gentle notification chime using Web Audio API synthesis (no external audio files needed)
function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    // Audio context may be restricted by browser policy before interaction
  }
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const knownMessageIdsRef = useRef(new Set());
  const initialLoadDoneRef = useRef(false);

  // Request browser desktop notification permission on load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const addNotification = (notif) => {
    const id = notif.id || `notif_${Date.now()}_${Math.random()}`;
    const newNotif = { ...notif, id, timestamp: Date.now() };

    playNotificationChime();

    // Browser Native Notification (if tab is backgrounded)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const title = `New Email: ${newNotif.sender?.name || newNotif.sender?.email || 'Gmail'}`;
        const browserNotif = new Notification(title, {
          body: `${newNotif.subject || '(No Subject)'}\n${newNotif.snippet || ''}`,
          icon: '/favicon.ico'
        });
        browserNotif.onclick = () => {
          window.focus();
          if (newNotif.threadId) {
            window.location.href = `/thread/${newNotif.threadId}`;
          }
        };
      } catch (e) {}
    }

    setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);

    // Auto dismiss after 8 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 8000);
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Background New Email Checker (Runs every 30 seconds when logged in)
  useEffect(() => {
    if (!user) return;

    // Fetch initial list of message IDs to avoid alerting for existing inbox items
    const seedKnownMessages = async () => {
      try {
        const res = await api.get('/emails?limit=30');
        const existingEmails = res.data.emails || [];
        existingEmails.forEach((e) => {
          if (e.messageId) knownMessageIdsRef.current.add(e.messageId);
        });
        initialLoadDoneRef.current = true;
      } catch (err) {}
    };

    seedKnownMessages();

    // Check periodically for new incoming emails
    const interval = setInterval(async () => {
      if (!initialLoadDoneRef.current) return;

      try {
        // Sync top 10 latest messages
        const res = await api.post('/emails/sync?maxResults=10');
        const synced = res.data.syncedEmails || [];

        synced.forEach((email) => {
          if (email.messageId && !knownMessageIdsRef.current.has(email.messageId)) {
            knownMessageIdsRef.current.add(email.messageId);

            // Trigger notification only for new incoming emails (not sent by self)
            if (!email.isRead && email.sender?.email !== user.email) {
              addNotification({
                id: email.messageId,
                sender: email.sender,
                subject: email.subject,
                snippet: email.snippet,
                threadId: email.threadId
              });
            }
          }
        });
      } catch (err) {
        // Silent error handling for background polling
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
