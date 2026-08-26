'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { CheckCircle2, Clock, AlertTriangle, ListTodo, ArrowRight, Pencil, FolderOpen } from 'lucide-react';
import Link from 'next/link';

export default function DashboardHome() {
  const { user, headers } = useAuth();
  const { currentWorkspace, currentProject } = useWorkspace();
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const { loadingWorkspaces, loadingProjects } = useWorkspace();

  useEffect(() => {
    if (loadingWorkspaces || loadingProjects) return;
    if (!currentWorkspace || !currentProject) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const [tasksRes, actRes, analyticsRes] = await Promise.all([
          fetch(`/api/tasks?project_id=${currentProject.id}&assignee_id=${user?.id}`, { headers: headers() }),
          fetch(`/api/activity?workspace_id=${currentWorkspace.id}&limit=10`, { headers: headers() }),
          fetch(`/api/analytics?workspace_id=${currentWorkspace.id}`, { headers: headers() }),
        ]);
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (actRes.ok) setActivities(await actRes.json());
        if (analyticsRes.ok) {
          const a = await analyticsRes.json();
          setStats({ total: a.totalTasks, completed: a.completedTasks, inProgress: a.inProgressTasks, overdue: a.overdueTasks || 0 });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [currentWorkspace, currentProject, user, headers, loadingWorkspaces, loadingProjects]);

  const priorityColors = { critical: 'var(--danger)', high: 'var(--warning)', medium: 'var(--primary)', low: 'var(--text-muted)' };
  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const formatAction = (action) => {
    const map = { task_created: 'created a task', task_moved: 'moved a task', task_completed: 'completed a task', task_deleted: 'deleted a task', comment_added: 'commented on a task', member_joined: 'joined the workspace', project_created: 'created a project' };
    return map[action] || action;
  };

  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading || loadingWorkspaces || loadingProjects) return <div className="full-page-loader"><div className="spinner spinner-lg" /></div>;

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>{date}</p>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Total Tasks', value: stats.total, icon: ListTodo, color: 'var(--primary)', bg: 'var(--primary-soft)' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-soft)' },
          { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'var(--warning)', bg: 'var(--warning-soft)' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'var(--danger)', bg: 'var(--danger-soft)' },
        ].map((s, i) => (
          <div key={i} className="card stat-card" style={{ animationDelay: `${i * 0.05}s`, animation: 'slideUp 0.4s ease forwards' }}>
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}><s.icon size={24} /></div>
            <div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="section-title" style={{ margin: 0 }}>My Tasks</h2>
            {currentProject && <Link href={`/dashboard/board/${currentProject.id}`} className="btn btn-ghost btn-sm">View Board <ArrowRight size={14} /></Link>}
          </div>
          {!currentProject ? (
            <div className="empty-state">
              <FolderOpen size={32} />
              <h3>No project selected</h3>
              <p>Create a project to start managing tasks.</p>
              <Link href="/dashboard/settings" className="btn btn-primary" style={{ marginTop: 16 }}>Go to Settings to Create Project</Link>
            </div>
          ) : tasks.length === 0 ? (
            <div className="empty-state"><ListTodo size={32} /><h3>No tasks assigned</h3><p>Tasks assigned to you will appear here.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.slice(0, 8).map(task => (
                <div key={task.id} className="dashboard-task-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', transition: 'all 200ms ease' }}>
                  <div className="badge-dot" style={{ background: priorityColors[task.priority] }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.column_name}</div>
                  </div>
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  <button
                    className="task-edit-btn"
                    title="Edit task"
                    style={{ opacity: 1, background: 'var(--bg-elevated)', padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, transition: 'all 200ms ease' }}
                    onClick={() => router.push(`/dashboard/board/${task.project_id}?highlight=${task.id}`)}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="section-title">Recent Activity</h2>
          {activities.length === 0 ? (
            <div className="empty-state"><Clock size={32} /><h3>No activity yet</h3><p>Recent activity will appear here.</p></div>
          ) : (
            <div>
              {activities.slice(0, 10).map(a => {
                let details = {};
                try { details = JSON.parse(a.details || '{}'); } catch {}
                return (
                  <div key={a.id} className="activity-item">
                    <div className="activity-dot" />
                    <div className="activity-text">
                      <strong>{a.user_name}</strong> {formatAction(a.action)}
                      {details.taskTitle && <span style={{ color: 'var(--primary-hover)' }}> &quot;{details.taskTitle}&quot;</span>}
                      {details.from && details.to && <span style={{ color: 'var(--text-muted)' }}> from {details.from} → {details.to}</span>}
                      <div className="activity-time">{timeAgo(a.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
