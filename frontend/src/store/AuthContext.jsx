import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reauthMessage, setReauthMessage] = useState(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setReauthMessage(null);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();

    // Listen for re-auth required event from interceptor
    const handleReauth = (event) => {
      setReauthMessage(
        event.detail || 'Your Google session has expired. Please reconnect your Gmail account.'
      );
      setUser(null);
    };

    window.addEventListener('app:reauth-required', handleReauth);
    return () => {
      window.removeEventListener('app:reauth-required', handleReauth);
    };
  }, []);

  const loginWithGoogle = () => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    window.location.href = `${backendUrl}/auth/google`;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        reauthMessage,
        setReauthMessage,
        loginWithGoogle,
        logout,
        refreshUser: fetchUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
