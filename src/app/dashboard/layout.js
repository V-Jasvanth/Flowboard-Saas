'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Columns3, Users, BarChart3, Bell, ChevronLeft, ChevronRight, LogOut, Zap, X, CheckCheck, Settings, User } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext';
import { NotificationProvider, useNotifications } from '@/contexts/NotificationContext';
import GlobalSearch from '@/components/GlobalSearch';

function DashboardShell({ children }) {
  const { user, loading, logout } = useAuth();
  const { currentWorkspace, projects, currentProject, workspaces, switchWorkspace } = useWorkspace();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', background: '#0a0a0f' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const firstBoard = currentProject ? `/dashboard/board/${currentProject.id}` : '/dashboard/board';

  const navItems = [
    { key: 'nav-dashboard', href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { key: 'nav-board', href: firstBoard, icon: Columns3, label: 'Board' },
    { key: 'nav-team', href: '/dashboard/team', icon: Users, label: 'Team' },
    { key: 'nav-analytics', href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
    { key: 'nav-settings', href: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  const avatarColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];
  const colorIndex = user?.name ? user.name.charCodeAt(0) % avatarColors.length : 0;

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="dashboard-layout">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div className="sidebar-logo">
          <div className="logo-icon"><Zap size={18} color="white" /></div>
          <span>FlowBoard</span>
        </div>
        <div className="sidebar-nav">
          {!collapsed && currentWorkspace && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Workspace</div>
              <select className="input" style={{ fontSize: 13, padding: '6px 10px', margin: '0 4px', width: 'calc(100% - 8px)' }} value={currentWorkspace.id} onChange={e => switchWorkspace(e.target.value)}>
                {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          <div className="sidebar-section">
            {!collapsed && <div className="sidebar-section-title">Menu</div>}
            {navItems.map(item => (
              <Link key={item.key} href={item.href} className={`nav-item ${pathname === item.href || (item.key === 'nav-board' && pathname.startsWith('/dashboard/board')) ? 'active' : ''}`}>
                <item.icon size={20} /><span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar avatar-sm" style={{ background: user?.avatar_url ? `url(${user.avatar_url}) center/cover` : avatarColors[colorIndex] }}>
              {!user?.avatar_url && initials}
            </div>
            {!collapsed && (
              <div className="user-info" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8, justifyContent: 'flex-start' }} onClick={logout}>
              <LogOut size={16} /><span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      <div className={`dashboard-main ${collapsed ? 'collapsed' : ''}`}>
        <header className="header">
          <div className="header-left">
            <GlobalSearch />
          </div>
          <div className="header-right">
            <button className="notification-bell" onClick={() => setNotifOpen(!notifOpen)} aria-label="Notifications" style={{ background: 'none', border: 'none' }}>
              <Bell size={20} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            <div style={{ position: 'relative' }}>
              <div 
                className="avatar avatar-sm" 
                style={{ background: user?.avatar_url ? `url(${user.avatar_url}) center/cover` : avatarColors[colorIndex], cursor: 'pointer' }} 
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                {!user?.avatar_url && initials}
              </div>
              {userMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setUserMenuOpen(false)} />
                  <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 180, zIndex: 200 }}>
                    <Link href="/dashboard/profile" className="dropdown-item" onClick={() => setUserMenuOpen(false)}><User size={14} /> Profile</Link>
                    <Link href="/dashboard/settings" className="dropdown-item" onClick={() => setUserMenuOpen(false)}><Settings size={14} /> Settings</Link>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <div className="dropdown-item danger" onClick={() => { setUserMenuOpen(false); logout(); }}><LogOut size={14} /> Sign Out</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard-content">{children}</div>
      </div>

      {notifOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setNotifOpen(false)} />
          <div className="notification-panel">
            <div className="notification-panel-header">
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Notifications</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={markAllAsRead}><CheckCheck size={14} /> Mark all</button>
                <button className="btn btn-ghost btn-icon" onClick={() => setNotifOpen(false)} aria-label="Close notifications"><X size={18} /></button>
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}><Bell size={32} /><h3>No notifications</h3><p>You&apos;re all caught up!</p></div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`} onClick={() => { markAsRead(n.id); if (n.link) { setNotifOpen(false); router.push(n.link); } }}>
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-message">{n.message}</div>
                  <div className="notif-time">{timeAgo(n.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <NotificationProvider>
          <DashboardShell>{children}</DashboardShell>
        </NotificationProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
