'use client';
import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User, Mail, Lock, Save, Shield, Palette, Monitor, Moon, Sun, Camera, Bell } from 'lucide-react';

export default function ProfilePage() {
  const { user, headers, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // New features state
  const [theme, setTheme] = useState(user?.theme || 'system');
  const [prefs, setPrefs] = useState(() => {
    try {
      return typeof user?.notification_preferences === 'string'
        ? JSON.parse(user.notification_preferences)
        : (user?.notification_preferences || { email: true, inApp: true });
    } catch {
      return { email: true, inApp: true };
    }
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  const avatarColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  const colorIndex = user?.name ? user.name.charCodeAt(0) % avatarColors.length : 0;

  const handleSaveProfile = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/auth/me', { method: 'PATCH', headers: headers(), body: JSON.stringify({ name: name.trim() }) });
      if (res.ok) { 
        updateUser({ name: name.trim() });
        setSaved(true); 
        setTimeout(() => setSaved(false), 2000); 
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const authHeader = headers().Authorization;
      const res = await fetch('/api/auth/avatar', { 
        method: 'POST', 
        headers: {
          'ngrok-skip-browser-warning': 'true',
          ...(authHeader ? { Authorization: authHeader } : {})
        }, 
        body: formData 
      });
      const data = await res.json();
      if (res.ok) {
        updateUser({ avatar_url: data.avatar_url });
      } else {
        alert(data.error || 'Failed to upload avatar');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    updateUser({ theme: newTheme });
    await fetch('/api/auth/me', { method: 'PATCH', headers: headers(), body: JSON.stringify({ theme: newTheme }) });
  };

  const handlePrefChange = async (key, val) => {
    const newPrefs = { ...prefs, [key]: val };
    setPrefs(newPrefs);
    updateUser({ notification_preferences: JSON.stringify(newPrefs) });
    await fetch('/api/auth/me', { method: 'PATCH', headers: headers(), body: JSON.stringify({ notification_preferences: newPrefs }) });
  };

  const handleChangePassword = async () => {
    setPwError(''); setPwSuccess('');
    if (!currentPw || !newPw) { setPwError('All fields are required'); return; }
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    try {
      const res = await fetch('/api/auth/password', { method: 'PATCH', headers: headers(), body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error || 'Failed'); return; }
      setPwSuccess('Password updated successfully');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwSuccess(''), 3000);
    } catch (e) { setPwError(e.message); }
  };

  if (!user) return <div className="full-page-loader"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Profile</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Manage your account settings</p>
      </div>

      {/* Profile Info */}
      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <User size={20} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Profile Information</h2>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <div 
              className="avatar avatar-xl" 
              style={{ 
                background: user?.avatar_url ? `url(${user.avatar_url}) center/cover` : avatarColors[colorIndex], 
                fontSize: 28, 
                flexShrink: 0,
                cursor: 'pointer',
                opacity: avatarUploading ? 0.5 : 1
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {!user?.avatar_url && initials}
              <div style={{
                position: 'absolute', bottom: -5, right: -5, 
                background: 'var(--primary)', color: '#fff',
                borderRadius: '50%', padding: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow)'
              }}>
                {avatarUploading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Camera size={14} />}
              </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" style={{ display: 'none' }} />
          </div>
          <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label>Full Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Email</label>
              <input className="input" value={user.email} disabled style={{ opacity: 0.6 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Email cannot be changed</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><Save size={16} /> Save</>}
              </button>
              {saved && <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 500 }}>✓ Updated</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Lock size={20} style={{ color: 'var(--warning)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Change Password</h2>
        </div>
        {pwError && <div className="error-message" style={{ marginBottom: 12 }}>{pwError}</div>}
        {pwSuccess && <div style={{ background: 'var(--success-soft)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, marginBottom: 12 }}>{pwSuccess}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
          <div className="input-group">
            <label>Current Password</label>
            <input className="input" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="input-group">
            <label>New Password</label>
            <input className="input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="input-group">
            <label>Confirm New Password</label>
            <input className="input" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" onClick={handleChangePassword} style={{ alignSelf: 'flex-start' }}>
            <Lock size={16} /> Update Password
          </button>
        </div>
      </div>



      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 24 }}>
        {/* Theme Selection */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Palette size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Theme Preference</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button 
              onClick={() => handleThemeChange('system')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', 
                background: theme === 'system' ? 'var(--primary-soft)' : 'var(--bg-elevated)', 
                border: `1px solid ${theme === 'system' ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', color: 'var(--text)', cursor: 'pointer',
                transition: 'all var(--transition)'
              }}
            >
              <Monitor size={18} style={{ color: theme === 'system' ? 'var(--primary)' : 'var(--text-secondary)' }} />
              <div style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>System Default</div>
              {theme === 'system' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />}
            </button>
            <button 
              onClick={() => handleThemeChange('dark')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', 
                background: theme === 'dark' ? 'var(--primary-soft)' : 'var(--bg-elevated)', 
                border: `1px solid ${theme === 'dark' ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', color: 'var(--text)', cursor: 'pointer',
                transition: 'all var(--transition)'
              }}
            >
              <Moon size={18} style={{ color: theme === 'dark' ? 'var(--primary)' : 'var(--text-secondary)' }} />
              <div style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>Dark Mode</div>
              {theme === 'dark' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />}
            </button>
            <button 
              onClick={() => handleThemeChange('light')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', 
                background: theme === 'light' ? 'var(--primary-soft)' : 'var(--bg-elevated)', 
                border: `1px solid ${theme === 'light' ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', color: 'var(--text)', cursor: 'pointer',
                transition: 'all var(--transition)'
              }}
            >
              <Sun size={18} style={{ color: theme === 'light' ? 'var(--primary)' : 'var(--text-secondary)' }} />
              <div style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>Light Mode</div>
              {theme === 'light' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />}
            </button>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Bell size={20} style={{ color: 'var(--success)' }} />
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Notifications</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={prefs.email} 
                onChange={(e) => handlePrefChange('email', e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: 'var(--text)' }}>Email Notifications</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Receive daily summaries and important alerts</div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={prefs.inApp} 
                onChange={(e) => handlePrefChange('inApp', e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: 'var(--text)' }}>In-App Notifications</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Show notifications inside the dashboard</div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Shield size={20} style={{ color: 'var(--cyan)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Account Information</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Account ID</div>
            <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{user.id?.slice(0, 8)}...</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Email</div>
            <div style={{ fontSize: 13 }}>{user.email}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Member Since</div>
            <div style={{ fontSize: 13 }}>{user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
