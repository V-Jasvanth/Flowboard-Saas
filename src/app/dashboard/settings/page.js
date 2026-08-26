'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Settings, Save, Building2, Palette, Shield, Plus, Trash2, FolderKanban, Users, Mail, UserMinus } from 'lucide-react';

export default function SettingsPage() {
  const { user, headers } = useAuth();
  const { currentWorkspace, loadWorkspaces, projects, currentProject, createProject, members, loadMembers, createWorkspace, loadingWorkspaces } = useWorkspace();
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectKey, setNewProjectKey] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#6366f1');
  const [projectError, setProjectError] = useState('');
  
  // Member state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // New Workspace state
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      setWsName(currentWorkspace.name || '');
      setWsDesc(currentWorkspace.description || '');
    }
  }, [currentWorkspace]);

  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) return;
    setCreatingWs(true);
    try {
      const res = await createWorkspace({ name: newWsName, description: newWsDesc });
      if (res.ok) {
        setNewWsName('');
        setNewWsDesc('');
        window.location.href = '/dashboard/settings';
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create workspace');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred');
    } finally {
      setCreatingWs(false);
    }
  };

  const handleSaveWorkspace = async () => {
    if (!wsName.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/workspaces/${currentWorkspace.id}`, {
        method: 'PATCH', headers: headers(),
        body: JSON.stringify({ name: wsName.trim(), description: wsDesc.trim() }),
      });
      await loadWorkspaces();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };


  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !newProjectKey.trim()) { setProjectError('Name and key are required'); return; }
    setProjectError('');
    try {
      const res = await createProject({ name: newProjectName, key: newProjectKey.toUpperCase(), color: newProjectColor });
      if (res.ok) {
        setShowNewProject(false);
        setNewProjectName(''); setNewProjectKey(''); setNewProjectColor('#6366f1');
      } else {
        const d = await res.json();
        setProjectError(d.error || 'Failed');
      }
    } catch (e) { setProjectError(e.message); }
  };

  const handleDeleteProject = async (projId) => {
    if (!confirm('Delete this project and all its data? This cannot be undone.')) return;
    try {
      await fetch(`/api/projects/${projId}`, { method: 'DELETE', headers: headers() });
      window.location.reload();
    } catch (e) { console.error(e); }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true); setInviteError(''); setInviteSuccess('');
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/members`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ email: inviteEmail.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setInviteSuccess('Member invited successfully!');
        setInviteEmail('');
        await loadMembers(currentWorkspace.id);
        setTimeout(() => setInviteSuccess(''), 3000);
      } else {
        setInviteError(data.error || 'Failed to invite member');
      }
    } catch (e) {
      setInviteError('An error occurred');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/members`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ userId, role: newRole })
      });
      if (res.ok) await loadMembers(currentWorkspace.id);
      else alert((await res.json()).error || 'Failed to update role');
    } catch (e) { console.error(e); }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this member from the workspace?')) return;
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/members?userId=${userId}`, {
        method: 'DELETE',
        headers: headers()
      });
      if (res.ok) await loadMembers(currentWorkspace.id);
      else alert((await res.json()).error || 'Failed to remove member');
    } catch (e) { console.error(e); }
  };

  const handleDeleteWorkspace = async () => {
    if (!confirm('Are you sure you want to delete this workspace? All projects, tasks, and data will be permanently removed. This action is irreversible.')) return;
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}`, {
        method: 'DELETE',
        headers: headers()
      });
      if (res.ok) {
        window.location.href = '/dashboard';
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete workspace');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while deleting the workspace');
    }
  };

  const projectColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

  if (loadingWorkspaces) return <div className="full-page-loader"><div className="spinner spinner-lg" /></div>;

  if (!currentWorkspace) {
    return (
      <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40 }}>
        <Building2 size={48} style={{ color: 'var(--text-muted)', marginBottom: 24 }} />
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Create your first Workspace</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center', maxWidth: 400 }}>
          Workspaces are where you organize your projects, boards, and team members. Create one to get started.
        </p>
        <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
          <div className="input-group">
            <label>Workspace Name</label>
            <input className="input" value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="e.g. Acme Corp" />
          </div>
          <div className="input-group">
            <label>Description (optional)</label>
            <textarea className="input" value={newWsDesc} onChange={e => setNewWsDesc(e.target.value)} placeholder="What is this workspace for?" rows={3} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleCreateWorkspace} disabled={creatingWs || !newWsName.trim()}>
            {creatingWs ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><Plus size={16} /> Create Workspace</>}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Manage workspace and project settings</p>
      </div>

      {/* Workspace Settings */}
      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Building2 size={20} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Workspace</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
          <div className="input-group">
            <label>Workspace Name</label>
            <input className="input" value={wsName} onChange={e => setWsName(e.target.value)} placeholder="My Workspace" />
          </div>
          <div className="input-group">
            <label>Description</label>
            <textarea className="input" value={wsDesc} onChange={e => setWsDesc(e.target.value)} placeholder="What is this workspace for?" rows={3} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSaveWorkspace} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><Save size={16} /> Save Changes</>}
            </button>
            {saved && <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 500 }}>✓ Saved</span>}
          </div>
        </div>
      </div>

      {/* Workspace Members Section */}
      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={20} style={{ color: 'var(--success)' }} />
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Workspace Members</h2>
          </div>
        </div>

        {/* Invite Member */}
        <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Invite New Member</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div className="input-group" style={{ flex: 1, maxWidth: 300, margin: 0 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: 10, left: 12, color: 'var(--text-muted)' }}><Mail size={16} /></div>
                <input 
                  className="input" 
                  value={inviteEmail} 
                  onChange={e => setInviteEmail(e.target.value)} 
                  placeholder="email@example.com" 
                  style={{ paddingLeft: 36 }}
                />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleInviteMember} disabled={inviteLoading || !inviteEmail.trim()}>
              {inviteLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Send Invite'}
            </button>
          </div>
          {inviteError && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{inviteError}</div>}
          {inviteSuccess && <div style={{ color: 'var(--success)', fontSize: 13, marginTop: 8 }}>{inviteSuccess}</div>}
        </div>

        {/* Member List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map(m => {
            const isCurrentUser = m.user_id === user?.id;
            const initials = m.user_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="avatar avatar-sm" style={{ background: m.user_avatar ? `url(${m.user_avatar}) center/cover` : 'var(--primary)', flexShrink: 0 }}>
                  {!m.user_avatar && initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.user_name}
                    {isCurrentUser && <span className="badge badge-primary" style={{ fontSize: 10 }}>You</span>}
                    {m.role === 'owner' && <span className="badge" style={{ background: 'var(--warning-soft)', color: 'var(--warning)', fontSize: 10 }}>Owner</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.user_email}</div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <select 
                    className="input" 
                    value={m.role} 
                    onChange={(e) => handleUpdateRole(m.user_id, e.target.value)}
                    disabled={m.role === 'owner' || isCurrentUser}
                    style={{ fontSize: 13, padding: '6px 10px', height: 'auto' }}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    {m.role === 'owner' && <option value="owner">Owner</option>}
                  </select>

                  <button 
                    className="btn btn-ghost btn-icon" 
                    title="Remove member"
                    onClick={() => handleRemoveMember(m.user_id)}
                    disabled={m.role === 'owner' || isCurrentUser}
                    style={{ color: (m.role === 'owner' || isCurrentUser) ? 'var(--text-muted)' : 'var(--danger)', opacity: (m.role === 'owner' || isCurrentUser) ? 0.5 : 1 }}
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Projects Section */}
      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderKanban size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Projects ({projects.length})</h2>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewProject(!showNewProject)}>
            <Plus size={14} /> New Project
          </button>
        </div>

        {showNewProject && (
          <div className="card card-elevated" style={{ padding: 16, marginBottom: 16, animation: 'slideDown 0.2s ease' }}>
            {projectError && <div className="error-message" style={{ marginBottom: 12 }}>{projectError}</div>}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="input-group" style={{ flex: 1, minWidth: 180 }}>
                <label>Project Name</label>
                <input className="input" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="My Project" />
              </div>
              <div className="input-group" style={{ width: 100 }}>
                <label>Key</label>
                <input className="input" value={newProjectKey} onChange={e => setNewProjectKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))} placeholder="PRJ" maxLength={5} />
              </div>
              <div className="input-group" style={{ width: 'auto' }}>
                <label>Color</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {projectColors.map(c => (
                    <div key={c} onClick={() => setNewProjectColor(c)} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: newProjectColor === c ? '2px solid white' : '2px solid transparent', transition: 'all 0.15s' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleCreateProject}>Create</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewProject(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', transition: 'all 200ms' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || 'var(--primary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Key: {p.key}</div>
              </div>
              {currentProject?.id === p.id && <span className="badge badge-primary" style={{ fontSize: 10 }}>Active</span>}
              <button className="btn btn-ghost btn-icon" title="Delete project" onClick={() => handleDeleteProject(p.id)} style={{ color: 'var(--danger)' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="empty-state" style={{ padding: 30 }}>
              <FolderKanban size={32} />
              <h3>No projects</h3>
              <p>Create your first project to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card" style={{ padding: 24, border: '1px solid rgba(239,68,68,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Shield size={20} style={{ color: 'var(--danger)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--danger)' }}>Danger Zone</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>These actions are irreversible. Proceed with caution.</p>
        <button className="btn btn-danger" onClick={handleDeleteWorkspace}>Delete Workspace</button>
      </div>
    </div>
  );
}
