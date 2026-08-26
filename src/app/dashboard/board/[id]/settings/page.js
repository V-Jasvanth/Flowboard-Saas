'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Settings, Save, AlertTriangle, Archive, Trash2, LayoutDashboard, Columns3 } from 'lucide-react';

export default function ProjectSettingsPage() {
  const params = useParams();
  const projectId = params?.id;
  const router = useRouter();
  const { headers } = useAuth();
  const { loadProjects, currentWorkspace } = useWorkspace();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon, setIcon] = useState('');

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`, { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          const p = data.project || data;
          setProject(p);
          setName(p.name || '');
          setDescription(p.description || '');
          setProjectKey(p.key || '');
          setColor(p.color || '#6366f1');
          setIcon(p.icon || '');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (projectId) fetchProject();
  }, [projectId, headers]);

  const handleSave = async () => {
    if (!name.trim() || !projectKey.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ name, description, key: projectKey, color, icon })
      });
      await loadProjects(currentWorkspace?.id);
      alert('Project saved successfully');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this project? It will be hidden from the active dashboard.')) return;
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: 'archived' })
      });
      await loadProjects(currentWorkspace?.id);
      router.push('/dashboard');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    const confirmation = prompt(`To delete this project permanently, please type its key: ${project?.key}`);
    if (confirmation !== project?.key) {
      if (confirmation !== null) alert('Key did not match. Deletion cancelled.');
      return;
    }
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: headers()
      });
      await loadProjects(currentWorkspace?.id);
      router.push('/dashboard');
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading project settings...</div>;
  if (!project) return <div style={{ padding: 40 }}>Project not found.</div>;

  return (
    <div className="kb-page" style={{ maxWidth: 800, margin: '0 auto', width: '100%', paddingBottom: 60 }}>
      {/* Header */}
      <div className="kb-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <div className="kb-header-top">
          <nav className="kb-breadcrumbs">
            <span className="kb-breadcrumb-item" onClick={() => router.push('/dashboard')}><LayoutDashboard size={14} /> Dashboard</span>
            <span className="kb-breadcrumb-sep">/</span>
            <span className="kb-breadcrumb-item" onClick={() => router.push(`/dashboard/board/${projectId}`)}><Columns3 size={14} /> {project.name}</span>
            <span className="kb-breadcrumb-sep">/</span>
            <span className="kb-breadcrumb-current">Settings</span>
          </nav>
        </div>
        <div className="kb-header-main" style={{ marginBottom: 24 }}>
          <div className="kb-header-title-area">
            <div>
              <h1 className="kb-title">Project Settings</h1>
              <div className="kb-subtitle">Manage project details, appearance, and lifecycle.</div>
            </div>
          </div>
        </div>
      </div>

      {/* General Settings Card */}
      <div className="card" style={{ padding: 32, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <Settings size={20} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>General Information</h2>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 20 }}>
            <div className="input-group" style={{ flex: 2 }}>
              <label>Project Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website Redesign" />
            </div>
            <div className="input-group" style={{ flex: 1 }}>
              <label>Project Key</label>
              <input className="input" value={projectKey} onChange={e => setProjectKey(e.target.value.toUpperCase())} placeholder="e.g. WEB" maxLength={5} />
            </div>
          </div>

          <div className="input-group">
            <label>Description</label>
            <textarea className="input" value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Briefly describe this project..." />
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label>Project Color</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }} />
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>{color}</span>
              </div>
            </div>
            
            <div className="input-group" style={{ flex: 1 }}>
              <label>Project Icon (Emoji)</label>
              <input className="input" value={icon} onChange={e => setIcon(e.target.value)} placeholder="e.g. 🚀" maxLength={2} style={{ fontSize: 20, textAlign: 'center', width: 80 }} />
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-start', marginTop: 10 }}>
            {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <><Save size={16} /> Save Changes</>}
          </button>
        </div>
      </div>

      {/* Danger Zone Card */}
      <div className="card" style={{ padding: 32, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--danger)' }}>Danger Zone</h2>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Archive Project</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Hide this project from the active dashboard. It can be restored later.</p>
            </div>
            <button className="btn btn-secondary" onClick={handleArchive}>
              <Archive size={16} /> Archive
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
            <div>
              <h3 style={{ fontWeight: 600, marginBottom: 4, color: 'var(--danger)' }}>Delete Project</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Permanently remove this project, all its boards, tasks, and comments. This action is irreversible.</p>
            </div>
            <button className="btn btn-danger" onClick={handleDelete}>
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
