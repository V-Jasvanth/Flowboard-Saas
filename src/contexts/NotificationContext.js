'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { headers, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { headers: headers() });
      if (res.ok) setNotifications(await res.json());
    } catch (e) { console.error('loadNotifications:', e); }
  }, [headers]);

  useEffect(() => { if (isAuthenticated) loadNotifications(); }, [isAuthenticated, loadNotifications]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, loadNotifications]);

  const markAsRead = async (id) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: headers(), body: JSON.stringify({ id }) });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
  };

  const markAllAsRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: headers(), body: JSON.stringify({ all: true }) });
    setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loadNotifications, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => { const ctx = useContext(NotificationContext); if (!ctx) throw new Error('useNotifications must be used within NotificationProvider'); return ctx; };
