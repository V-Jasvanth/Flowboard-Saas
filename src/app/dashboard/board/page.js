'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Columns3, Plus, FolderOpen, ArrowRight, Loader2 } from 'lucide-react';

export default function BoardIndexPage() {
  const { headers } = useAuth();
  const { currentWorkspace, projects, currentProject, loadingProjects } = useWorkspace();
  const router = useRouter();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  // If we already know the current project, redirect directly to its board
  useEffect(() => {
    if (currentProject) {
      router.replace(`/dashboard/board/${currentProject.id}`);
    }
  }, [currentProject, router]);

  // Load all boards from all projects in the workspace
  useEffect(() => {
    if (loadingProjects) return;
    async function loadBoards() {
      if (!projects || projects.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const allBoards = [];
        for (const project of projects) {
          try {
            const res = await fetch(`/api/projects/${project.id}`, { headers: headers() });
            if (res.ok) {
              const data = await res.json();
              if (data.boards) {
                data.boards.forEach(b => allBoards.push({ ...b, project }));
              }
            }
          } catch {}
        }
        setBoards(allBoards);
      } catch (e) {
        console.error('Failed to load boards:', e);
      } finally {
        setLoading(false);
      }
    }
    if (!currentProject) loadBoards();
  }, [projects, currentProject, headers, loadingProjects]);

  // Show loading while redirecting or fetching
  if (loadingProjects || loading || currentProject) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
        <Loader2 size={32} className="spinner" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading boards...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Boards</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {currentWorkspace?.name || 'Workspace'} — {boards.length} board{boards.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {boards.length === 0 ? (
        <div className="card card-elevated" style={{ padding: 48, textAlign: 'center' }}>
          <FolderOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No boards yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
            Create a project to get started with your first board.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/dashboard/settings')}
          >
            Go to Settings to Create Project
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {boards.map(board => (
            <div
              key={board.id}
              className="card card-elevated"
              style={{ padding: 20, cursor: 'pointer', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: 16 }}
              onClick={() => router.push(`/dashboard/board/${board.project?.id || board.id}`)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.transform = ''; }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: board.project?.color || 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {(board.project?.key || 'B').slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{board.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {board.project?.name || 'Project'} · {board.project?.key || ''}
                </div>
              </div>
              <ArrowRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
