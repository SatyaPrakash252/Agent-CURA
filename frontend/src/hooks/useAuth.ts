'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_V1 } from '../lib/constants';

interface User {
  username: string;
  full_name: string;
  role: string;
  expertise?: string;
  credentials?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  // Check for saved token on mount
  useEffect(() => {
    const saved = localStorage.getItem('cura_token');
    if (saved) {
      verifyToken(saved);
    } else {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const res = await fetch(`${API_V1}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        setState({ user, token, loading: false });
      } else {
        localStorage.removeItem('cura_token');
        setState({ user: null, token: null, loading: false });
      }
    } catch {
      setState({ user: null, token: null, loading: false });
    }
  };

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_V1}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('cura_token', data.access_token);
        setState({
          user: {
            username: data.username,
            full_name: data.full_name,
            role: data.role,
            expertise: data.expertise,
            credentials: data.credentials,
          },
          token: data.access_token,
          loading: false,
        });
        return null; // no error
      } else {
        const err = await res.json().catch(() => ({ detail: 'Login failed' }));
        return err.detail || 'Invalid credentials';
      }
    } catch {
      return 'Network error. Is the backend running?';
    }
  }, []);

  const signup = useCallback(async (
    username: string, 
    password: string, 
    fullName: string, 
    expertise: string, 
    credentials: string
  ): Promise<string | null> => {
    try {
      const res = await fetch(`${API_V1}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password, 
          full_name: fullName, 
          expertise, 
          credentials 
        }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('cura_token', data.access_token);
        setState({
          user: {
            username: data.username,
            full_name: data.full_name,
            role: data.role,
            expertise: data.expertise,
            credentials: data.credentials,
          },
          token: data.access_token,
          loading: false,
        });
        return null; // no error
      } else {
        const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
        return err.detail || 'Failed to register doctor';
      }
    } catch {
      return 'Network error. Is the backend running?';
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('cura_token');
    setState({ user: null, token: null, loading: false });
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (state.token) {
      return { Authorization: `Bearer ${state.token}` };
    }
    return {};
  }, [state.token]);

  return {
    user: state.user,
    token: state.token,
    loading: state.loading,
    isAuthenticated: !!state.user,
    login,
    signup,
    logout,
    getAuthHeaders,
  };
}
