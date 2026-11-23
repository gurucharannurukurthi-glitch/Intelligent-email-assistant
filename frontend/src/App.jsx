import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { ThemeProvider } from './store/ThemeContext';
import { NotificationProvider } from './store/NotificationContext';
import { NavProvider } from './store/NavContext';
import { NotificationToast } from './components/NotificationToast';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Thread } from './pages/Thread';
import { Compose } from './pages/Compose';
import { Search } from './pages/Search';
import { ActionCenter } from './pages/ActionCenter';
import { Sparkles } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen theme-app-bg flex flex-col items-center justify-center theme-text-muted gap-3">
        <div className="w-12 h-12 rounded-2xl bg-brand-600/10 border border-brand-500/30 flex items-center justify-center text-brand-500 animate-pulse">
          <Sparkles className="w-6 h-6 animate-spin" />
        </div>
        <div className="text-sm font-medium">Loading session...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
            <NavProvider>
              <NotificationToast />
              <Routes>
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/thread/:threadId"
                  element={
                    <ProtectedRoute>
                      <Thread />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/search"
                  element={
                    <ProtectedRoute>
                      <Search />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/action-center"
                  element={
                    <ProtectedRoute>
                      <ActionCenter />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/compose"
                  element={
                    <ProtectedRoute>
                      <Compose />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </NavProvider>
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
