import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { EmailList } from '../components/EmailList';
import api from '../services/api';

export function Dashboard() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [folder, setFolder] = useState('INBOX');
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const fetchEmails = useCallback(
    async (currentFolder = folder, currentSearch = search) => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get('/emails', {
          params: {
            limit: 150, // Load all emails in single continuous scroll view
            folder: currentFolder,
            search: currentSearch
          }
        });
        setEmails(res.data.emails || []);
        setTotal(res.data.total || 0);
      } catch (err) {
        console.error('Error fetching emails:', err);
        setError(err.response?.data?.message || 'Failed to load emails from database.');
      } finally {
        setLoading(false);
      }
    },
    [folder, search]
  );

  useEffect(() => {
    fetchEmails(folder, search);
    // Silent background sync to reconcile any external Gmail web deletions
    api.post(`/emails/sync?maxResults=50&folder=${folder}`)
      .then(() => fetchEmails(folder, search))
      .catch(() => {});
  }, [folder]);

  const handleSearchChange = (newSearch) => {
    setSearch(newSearch);
    fetchEmails(folder, newSearch);
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setError(null);
      // Fast parallel sync for current active folder
      await api.post(`/emails/sync?maxResults=40&folder=${folder}`);
      await fetchEmails(folder, search);
    } catch (err) {
      console.error('Error syncing emails:', err);
      setError(err.response?.data?.message || 'Failed to sync with Gmail API.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleStar = async (targetEmail) => {
    const updatedStatus = !targetEmail.isStarred;
    setEmails((prev) =>
      prev.map((e) => (e._id === targetEmail._id ? { ...e, isStarred: updatedStatus } : e))
    );

    try {
      await api.patch(`/emails/${targetEmail._id}`, { isStarred: updatedStatus });
    } catch (err) {
      setEmails((prev) =>
        prev.map((e) => (e._id === targetEmail._id ? { ...e, isStarred: !updatedStatus } : e))
      );
    }
  };

  const handleToggleRead = async (targetEmail) => {
    const updatedStatus = !targetEmail.isRead;
    setEmails((prev) =>
      prev.map((e) => (e._id === targetEmail._id ? { ...e, isRead: updatedStatus } : e))
    );

    try {
      await api.patch(`/emails/${targetEmail._id}`, { isRead: updatedStatus });
    } catch (err) {
      setEmails((prev) =>
        prev.map((e) => (e._id === targetEmail._id ? { ...e, isRead: !updatedStatus } : e))
      );
    }
  };

  const handleArchive = async (targetEmail) => {
    setEmails((prev) => prev.filter((e) => e._id !== targetEmail._id));
    setTotal((prev) => Math.max(0, prev - 1));

    try {
      await api.patch(`/emails/${targetEmail._id}`, { isArchived: true });
    } catch (err) {
      fetchEmails(folder, search);
    }
  };

  const handleDelete = async (targetEmail) => {
    // Optimistic UI update
    const previousEmails = emails;
    const previousTotal = total;
    setEmails((prev) => prev.filter((e) => e._id !== targetEmail._id && e.threadId !== targetEmail.threadId));
    setTotal((prev) => Math.max(0, prev - 1));

    try {
      if (targetEmail.threadId) {
        await api.delete(`/emails/thread/${targetEmail.threadId}`);
      } else {
        await api.delete(`/emails/${targetEmail._id}`);
      }
    } catch (err) {
      console.error('Error deleting from Gmail:', err);
      // Rollback optimistic update
      setEmails(previousEmails);
      setTotal(previousTotal);
      setError(err.response?.data?.message || 'Failed to delete email from Gmail. Restored previous state.');
    }
  };

  const handleSelectFolder = (newFolder) => {
    setFolder(newFolder);
    setSearch('');
  };

  return (
    <div className="theme-app-bg min-h-screen flex flex-col transition-colors">
      <Navbar onSync={handleSync} isSyncing={isSyncing} />

      <div className="flex-1 flex min-h-0">
        <Sidebar currentFolder={folder} onSelectFolder={handleSelectFolder} />

        <main className="flex-1 flex flex-col min-w-0">
          {error && (
            <div className="m-3 sm:m-4 p-3 bg-red-500/10 border border-red-500/30 text-red-600 text-xs rounded-xl flex items-center justify-between shadow-sm">
              <span className="truncate">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="hover:underline ml-4 font-semibold shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          <EmailList
            emails={emails}
            loading={loading}
            total={total}
            folder={folder}
            search={search}
            onSearchChange={handleSearchChange}
            onToggleStar={handleToggleStar}
            onToggleRead={handleToggleRead}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
