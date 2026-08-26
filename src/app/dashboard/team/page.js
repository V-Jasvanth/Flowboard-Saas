'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { UserPlus, Shield, Crown, Users as UsersIcon, Mail, X, MoreVertical, Trash2 } from 'lucide-react';

export default function TeamPage() {
  const { user, headers } = useAuth();
  const { currentWorkspace, members, loadMembers, loadingMembers } = useWorkspace();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const toast = useToast();

  const avatarColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];
  const roleConfig = {
    owner: { label: 'Owner', icon: Crown, color: 'var(--primary)', bg: 'var(--primary-soft)', badgeClass: 'badge-owner' },
    admin: { label: 'Admin', icon: Shield, color: 'var(--accent)', bg: 'rgba(139,92,246,0.15)', badgeClass: 'badge-admin' },
    member: { label: 'Member', icon: UsersIcon, color: 'var(--cyan)', bg: 'rgba(6,182,212,0.15)', badgeClass: 'badge-member' },
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/members`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add member');
      toast.success(`${inviteEmail} has been added to the workspace!`);
      setInviteEmail('');
      setShowInvite(false);
      loadMembers(currentWorkspace.id);
    } catch (err) { toast.error(err.message); }
    finally { setInviteLoading(false); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/members`, {
        method: 'PATCH', headers: headers(), body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
      loadMembers(currentWorkspace.id);
      setOpenMenu(null);
      toast.success('Role updated successfully');
    } catch (err) { toast.error(err.message || 'Failed to update role'); }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/members`, {
        method: 'DELETE', headers: headers(), body: JSON.stringify({ userId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
      loadMembers(currentWorkspace.id);
      setOpenMenu(null);
      toast.success('Member removed');
    } catch (err) { toast.error(err.message || 'Failed to remove member'); }
  };

  const currentUserRole = members.find(m => (m.user_id || m.id) === user?.id)?.role;
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  if (loadingMembers && members.length === 0) {
    return (
      <div className="animate-fade">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Team</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Loading members...</p>
        </div>
        <div className="team-grid">
          {[1,2,3].map(i => (
            <div key={i} className="card member-card">
              <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
              <div className="member-info">
                <div className="skeleton" style={{ width: 120, height: 16, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: 180, height: 14 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Team</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
            {members.length} member{members.length !== 1 ? 's' : ''} in {currentWorkspace?.name || 'workspace'}
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowInvite(!showInvite)}>
            <UserPlus size={16} /> Invite Member
          </button>
        )}
      </div>

      {showInvite && (
        <div className="card card-elevated" style={{ marginBottom: 24, animation: 'slideDown 0.2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Invite a team member</h3>
            <button className="btn btn-ghost btn-icon" onClick={() => setShowInvite(false)}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 12 }}>
            <div className="input-icon-wrapper" style={{ flex: 1 }}>
              <Mail />
              <input className="input" type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={inviteLoading}>
              {inviteLoading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Add Member'}
            </button>
          </form>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            The user must already have a FlowBoard account. Try adding <strong>alice@flowboard.com</strong> or <strong>bob@flowboard.com</strong>.
          </p>
        </div>
      )}

      <div className="team-grid">
        {members.map((member, i) => {
          const name = member.name;
          const email = member.email;
          const role = member.role || 'member';
          const userId = member.user_id || member.id;
          const rc = roleConfig[role] || roleConfig.member;
          const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
          const colorIdx = name.charCodeAt(0) % avatarColors.length;
          const isCurrentUser = userId === user?.id;

          return (
            <div key={userId || i} className="card member-card" style={{ animation: `slideUp 0.3s ease ${i * 0.05}s both` }}>
              <div className="avatar avatar-lg" style={{ background: avatarColors[colorIdx] }}>{initials}</div>
              <div className="member-info">
                <div className="member-name">
                  {name} {isCurrentUser && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>(you)</span>}
                </div>
                <div className="member-email">{email}</div>
                <span className={`badge ${rc.badgeClass}`} style={{ marginTop: 6 }}>
                  <rc.icon size={12} /> {rc.label}
                </span>
              </div>
              {canManage && !isCurrentUser && role !== 'owner' && (
                <div className="dropdown">
                  <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === userId ? null : userId); }}>
                    <MoreVertical size={16} />
                  </button>
                  {openMenu === userId && (
                    <div className="dropdown-menu" onClick={e => e.stopPropagation()}>
                      {role !== 'admin' && (
                        <div className="dropdown-item" onClick={() => handleRoleChange(userId, 'admin')}>
                          <Shield size={14} /> Make Admin
                        </div>
                      )}
                      {role !== 'member' && (
                        <div className="dropdown-item" onClick={() => handleRoleChange(userId, 'member')}>
                          <UsersIcon size={14} /> Make Member
                        </div>
                      )}
                      <div className="dropdown-item danger" onClick={() => handleRemoveMember(userId)}>
                        <Trash2 size={14} /> Remove
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {members.length === 0 && (
        <div className="empty-state">
          <UsersIcon size={48} />
          <h3>No team members</h3>
          <p>Invite people to start collaborating on this workspace.</p>
          <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
            <UserPlus size={16} /> Invite Member
          </button>
        </div>
      )}
    </div>
  );
}
