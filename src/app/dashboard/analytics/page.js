'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { BarChart3, TrendingUp, CheckCircle2, Clock, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, Area, AreaChart } from 'recharts';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];
const PRIORITY_COLORS = { critical: '#ef4444', high: '#f59e0b', medium: '#6366f1', low: '#64748b' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#f1f5f9', fontWeight: 600 }}>{p.name || p.dataKey}: {p.value}</p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const { headers } = useAuth();
  const { currentWorkspace, members, loadingMembers } = useWorkspace();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/analytics?workspace_id=${currentWorkspace.id}`, { headers: headers() });
        if (res.ok) setData(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [currentWorkspace, headers]);

  if (loading) return <div className="full-page-loader"><div className="spinner spinner-lg" /></div>;
  
  if (!data || data.totalTasks === 0) {
    return (
      <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', marginBottom: 24 }}>
          <BarChart3 size={40} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>No Analytics Data Yet</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
          It looks like your team hasn't created any tasks yet. Once you start managing projects, your analytics dashboard will populate with beautiful insights!
        </p>
      </div>
    );
  }

  const priorityData = (data.tasksByPriority || []).map(p => ({ name: p.priority.charAt(0).toUpperCase() + p.priority.slice(1), value: p.count, fill: PRIORITY_COLORS[p.priority] || '#6366f1' }));
  const statusData = (data.tasksByStatus || []).map(s => ({ name: s.status, value: s.count, fill: s.color || '#6366f1' }));
  const assigneeData = (data.tasksByAssignee || []).map((a, i) => ({ name: a.name?.split(' ')[0] || 'Unknown', tasks: a.count, fill: CHART_COLORS[i % CHART_COLORS.length] }));
  const trendData = (data.completedOverTime || []).map(d => ({ date: d.date.slice(5), tasks: d.count }));

  const completionRate = data.totalTasks > 0 ? Math.round((data.completedTasks / data.totalTasks) * 100) : 0;

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Track your team&apos;s progress and performance</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Tasks', value: data.totalTasks, icon: Target, color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
          { label: 'Completed', value: data.completedTasks, icon: CheckCircle2, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
          { label: 'In Progress', value: data.inProgressTasks, icon: Clock, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
          { label: 'Completion Rate', value: `${completionRate}%`, icon: TrendingUp, color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
        ].map((s, i) => (
          <div key={i} className="card stat-card" style={{ animation: `slideUp 0.4s ease ${i * 0.05}s both` }}>
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}><s.icon size={24} /></div>
            <div><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="charts-row" style={{ marginBottom: 24 }}>
        <div className="card chart-container">
          <h3>Tasks by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Tasks">
                  {statusData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No data</p>}
        </div>

        <div className="card chart-container">
          <h3>Tasks by Priority</h3>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#64748b' }}>
                  {priorityData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No data</p>}
        </div>
      </div>

      <div className="charts-row" style={{ marginBottom: 24 }}>
        <div className="card chart-container">
          <h3>Completion Trend (30 days)</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} interval={4} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="tasks" stroke="#6366f1" fill="url(#completedGradient)" strokeWidth={2} name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No data</p>}
        </div>

        <div className="card chart-container">
          <h3>Tasks by Assignee</h3>
          {assigneeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={assigneeData} layout="vertical" barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="tasks" radius={[0, 6, 6, 0]} name="Tasks">
                  {assigneeData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No data</p>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Performance Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Avg. Completion Time</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary-hover)' }}>{data.averageCompletionDays} days</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Open Tasks</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{data.openTasks}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Team Size</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--cyan)' }}>
              {loadingMembers && members.length === 0 ? <span className="spinner spinner-sm" /> : <>{members.length} member{members.length !== 1 ? 's' : ''}</>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Completion Rate</div>
            <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--bg-elevated)', marginTop: 8 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, var(--primary), var(--success))`, width: `${completionRate}%`, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>{completionRate}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
