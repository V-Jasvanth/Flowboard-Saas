'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { headers, isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Use refs to avoid stale closures in useCallback dependencies
  const currentWorkspaceRef = useRef(null);
  const currentProjectRef = useRef(null);

  useEffect(() => { currentWorkspaceRef.current = currentWorkspace; }, [currentWorkspace]);
  useEffect(() => { currentProjectRef.current = currentProject; }, [currentProject]);

  const loadWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await fetch('/api/workspaces', { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        const ws = data.workspaces || data;
        setWorkspaces(ws);
        if (ws.length > 0) {
          const isValid = currentWorkspaceRef.current && ws.some(w => w.id === currentWorkspaceRef.current.id);
          if (!isValid) {
            setCurrentWorkspace(ws[0]);
          }
        } else {
          setCurrentWorkspace(null);
        }
      }
    } catch (e) { console.error('loadWorkspaces:', e); }
    finally { setLoadingWorkspaces(false); }
  }, [headers]);

  const loadProjects = useCallback(async (wsId) => {
    if (!wsId || wsId === 'undefined') return;
    setLoadingProjects(true);
    try {
      const res = await fetch(`/api/projects?workspace_id=${wsId}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        const pjs = data.projects || data;
        setProjects(pjs);
        if (pjs.length > 0 && !currentProjectRef.current) {
          setCurrentProject(pjs[0]);
        }
      }
    } catch (e) { console.error('loadProjects:', e); }
    finally { setLoadingProjects(false); }
  }, [headers]);

  const loadMembers = useCallback(async (wsId) => {
    if (!wsId || wsId === 'undefined') return;
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/workspaces/${wsId}/members`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        const raw = data.members || data;
        const normalized = (Array.isArray(raw) ? raw : []).map(m => ({
          ...m,
          name: m.name || m.user_name || 'Unknown',
          email: m.email || m.user_email || '',
          avatar_url: m.avatar_url || m.user_avatar || null,
        }));
        setMembers(normalized);
      } else {
        setMembers([]);
      }
    } catch (e) {
      console.error('loadMembers:', e);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [headers]);

  // Load workspaces on auth
  useEffect(() => {
    if (isAuthenticated) loadWorkspaces();
  }, [isAuthenticated, loadWorkspaces]);

  // Load projects and members when workspace changes
  useEffect(() => {
    if (currentWorkspace) {
      loadProjects(currentWorkspace.id);
      loadMembers(currentWorkspace.id);
    }
  }, [currentWorkspace, loadProjects, loadMembers]);

  const switchWorkspace = (id) => {
    const ws = workspaces.find(w => w.id === id);
    if (ws) {
      setCurrentWorkspace(ws);
      setCurrentProject(null);
      currentProjectRef.current = null;
      setProjects([]);
      setMembers([]);
    }
  };

  const switchProject = (id) => {
    const p = projects.find(pr => pr.id === id);
    if (p) setCurrentProject(p);
  };

  const createWorkspace = async (data) => {
    const res = await fetch('/api/workspaces', { method: 'POST', headers: headers(), body: JSON.stringify(data) });
    if (res.ok) { await loadWorkspaces(); }
    return res;
  };

  const createProject = async (data) => {
    const res = await fetch('/api/projects', { method: 'POST', headers: headers(), body: JSON.stringify({ ...data, workspace_id: currentWorkspace?.id }) });
    if (res.ok) { await loadProjects(currentWorkspace?.id); }
    return res;
  };

  return (
    <WorkspaceContext.Provider value={{
      workspaces, currentWorkspace, projects, currentProject, members,
      loadingWorkspaces, loadingProjects, loadingMembers,
      loadWorkspaces, switchWorkspace, loadProjects, switchProject,
      loadMembers, createWorkspace, createProject
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
};
