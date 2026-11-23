import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor to handle session expiration or Google token invalidation cleanly
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // If server signals that Google auth expired or session died, dispatch event
      const isReauthRequired = error.response.data?.requiresReauth;
      if (isReauthRequired) {
        window.dispatchEvent(
          new CustomEvent('app:reauth-required', {
            detail: error.response.data.message
          })
        );
      }
    }
    return Promise.reject(error);
  }
);

export default api;
