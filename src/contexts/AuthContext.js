'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    const match = document.cookie.split('; ').find(r => r.startsWith('flowboard-token='));
    return match?.split('=')[1] || localStorage.getItem('flowboard-token');
  };

  const setToken = (token) => {
    document.cookie = `flowboard-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    localStorage.setItem('flowboard-token', token);
  };

  const clearToken = () => {
    document.cookie = 'flowboard-token=; path=/; max-age=0';
    localStorage.removeItem('flowboard-token');
  };

  const headers = useCallback(() => {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) { setLoading(false); return; }
      const res = await fetch('/api/auth/me', { headers: headers() });
      if (res.ok) { const data = await res.json(); setUser(data.user || data); }
      else { clearToken(); setUser(null); }
    } catch { clearToken(); setUser(null); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const theme = user?.theme || 'system';
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.remove('theme-light');
    } else {
      document.documentElement.classList.add('theme-light');
    }
  }, [user?.theme]);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => { clearToken(); setUser(null); window.location.href = '/';  };

  const updateUser = (updates) => setUser(prev => ({ ...prev, ...updates }));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user, headers, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth must be used within AuthProvider'); return ctx; };
