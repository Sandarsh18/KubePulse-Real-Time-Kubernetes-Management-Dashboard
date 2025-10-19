import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Configure axios defaults
const API_URL = (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) || window.location.origin;
axios.defaults.baseURL = API_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Axios interceptor to attach JWT token to requests
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle 401 errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get('/api/auth/me');
      // The backend returns { success, data: { user: { ... } } }
      // Ensure we set the actual user object, not the wrapper
      setUser(response.data?.data?.user || null);
      setError(null);
    } catch (err) {
      console.error('Auth check failed:', err);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/login', { email, password });
      const { token, user: userData } = response.data.data;
      
      localStorage.setItem('token', token);
      setUser(userData);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const signup = async (username, email, password) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/signup', { username, email, password });
      const { token, user: userData } = response.data.data;
      
      localStorage.setItem('token', token);
      setUser(userData);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Signup failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const isAdmin = () => {
    return user?.role === 'admin';
  };

  const isViewer = () => {
    return user?.role === 'viewer';
  };

  const value = {
    user,
    loading,
    error,
    login,
    signup,
    logout,
    checkAuth,
    isAuthenticated: !!user,
    isAdmin,
    isViewer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
