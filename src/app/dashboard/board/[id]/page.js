'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import TaskDetailPanel from '@/components/TaskDetailPanel';
import {
  Plus, X, MessageSquare, Calendar, Hash, GripVertical, Pencil, Trash2,
  MoreVertical, ChevronRight, LayoutDashboard, Columns3, Filter, Search,
  AlertCircle, CheckCircle2, Clock, Flag, User, Tag, Zap, Inbox,
  ArrowUpCircle, ArrowDownCircle, MinusCircle, AlertTriangle, Settings
} from 'lucide-react';

// ============================================================
// PRIORITY CONFIG
// ============================================================
const PRIORITY_CONFIG = {
  critical: { icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Critical' },
  high:     { icon: ArrowUpCircle,  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'High' },
  medium:   { icon: MinusCircle,    color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  label: 'Medium' },
  low:      { icon: ArrowDownCircle,color: '#64748b', bg: 'rgba(100,116,139,0.15)', label: 'Low' },
};

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#22c55e','#f59e0b','#ef4444','#ec4899','#14b8a6'];
function getAvatarColor(name) { return AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(name) { return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase(); }

// ============================================================
// MAIN BOARD PAGE
// ============================================================
export default function BoardPage() {
  const { id: projectId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, headers } = useAuth();
  const { members, currentWorkspace, currentProject } = useWorkspace();

  // Core state
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [boardId, setBoardId] = useState(null);

  // Task interactions
  const [selectedTask, setSelectedTask] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);

  // Drag state
  const [dragTaskId, setDragTaskId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Filters
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Column management
  const [colMenuOpen, setColMenuOpen] = useState(null);
  const [renamingCol, setRenamingCol] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');

  // Create Task modal
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskColId, setCreateTaskColId] = useState(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState(null);

  // ---- DATA LOADING ----
  const loadBoard = useCallback(async () => {
    try {
      const [tasksRes, projectRes] = await Promise.all([
        fetch(`/api/tasks?project_id=${projectId}`, { headers: headers() }),
        fetch(`/api/projects/${projectId}`, { headers: headers() }),
      ]);
      if (!tasksRes.ok || !projectRes.ok) return;
      const tasks = await tasksRes.json();
      const projectData = await projectRes.json();
      const project = projectData.project || projectData;
      const projectBoards = projectData.boards || [];

      let cols = [];
      if (projectBoards.length > 0) {
        const boardApiRes = await fetch(`/api/boards/${projectBoards[0].id}`, { headers: headers() });
        if (boardApiRes.ok) {
          const boardApiData = await boardApiRes.json();
          cols = boardApiData.columns || [];
        }
      }

      if (cols.length === 0) {
        const colMap = new Map();
        tasks.forEach(t => {
          if (t.column_id && t.column_name && !colMap.has(t.column_id)) {
            colMap.set(t.column_id, { id: t.column_id, name: t.column_name, color: t.column_color || '#64748b', position: colMap.size });
          }
        });
        cols = [...colMap.values()];
        if (cols.length === 0) cols = [{ id: 'default', name: 'To Do', color: '#3b82f6', position: 0 }];
      }

      const columnsWithTasks = cols.sort((a, b) => a.position - b.position).map(col => ({
        ...col,
        tasks: (col.tasks || tasks.filter(t => t.column_id === col.id)).sort((a, b) => a.position - b.position),
      }));

      setBoard(project);
      setColumns(columnsWithTasks);
      if (projectBoards.length > 0) setBoardId(projectBoards[0].id);
    } catch (e) { console.error('loadBoard:', e); }
    finally { setLoading(false); }
  }, [projectId, headers]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // Keyboard shortcut for Create Task (C)
  useEffect(() => {
    const handleShortcut = (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCreateTaskColId(null);
        setShowCreateTask(true);
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  // ---- SEARCH HIGHLIGHT ----
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && columns.length > 0 && !loading) {
      setHighlightedTaskId(highlightId);
      requestAnimationFrame(() => {
        const el = document.getElementById(`task-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      });
      const timer = setTimeout(() => {
        setHighlightedTaskId(null);
        window.history.replaceState(null, '', `/dashboard/board/${projectId}`);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, columns, loading, projectId]);

  // ---- CLOSE CONTEXT MENU ON CLICK ----
  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ---- DRAG & DROP ----
  const handleDragStart = (e, taskId) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    requestAnimationFrame(() => e.target.classList.add('kb-dragging'));
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('kb-dragging');
    setDragTaskId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCol(null);
    }
  };

  const handleDrop = async (e, targetColId) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!dragTaskId) return;

    // Optimistic update
    setColumns(prev => {
      const newCols = prev.map(col => ({ ...col, tasks: [...col.tasks] }));
      let taskData = null;
      newCols.forEach(col => {
        const ti = col.tasks.findIndex(t => t.id === dragTaskId);
        if (ti !== -1) { taskData = col.tasks.splice(ti, 1)[0]; }
      });
      if (taskData) {
        const targetCol = newCols.find(c => c.id === targetColId);
        if (targetCol) { taskData.column_id = targetColId; targetCol.tasks.push(taskData); }
      }
      return newCols;
    });

    try {
      const targetCol = columns.find(c => c.id === targetColId);
      const newPos = targetCol ? targetCol.tasks.length : 0;
      await fetch('/api/tasks/reorder', {
        method: 'PATCH', headers: headers(),
        body: JSON.stringify({ taskId: dragTaskId, targetColumnId: targetColId, newPosition: newPos }),
      });
    } catch (e) { console.error('reorder error:', e); loadBoard(); }
  };

  // ---- TASK ACTIONS ----
  const openTaskDetail = async (task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { headers: headers() });
      if (res.ok) setSelectedTask(await res.json());
    } catch (e) { console.error(e); }
  };

  const updateTask = async (field, value) => {
    if (!selectedTask) return;
    try {
      await fetch(`/api/tasks/${selectedTask.id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ [field]: value }) });
      const res = await fetch(`/api/tasks/${selectedTask.id}`, { headers: headers() });
      if (res.ok) setSelectedTask(await res.json());
      loadBoard();
    } catch (e) { console.error(e); }
  };

  const addComment = async (content) => {
    if (!selectedTask || !content.trim()) return;
    try {
      await fetch(`/api/tasks/${selectedTask.id}/comments`, { method: 'POST', headers: headers(), body: JSON.stringify({ content }) });
      const res = await fetch(`/api/tasks/${selectedTask.id}`, { headers: headers() });
      if (res.ok) setSelectedTask(await res.json());
    } catch (e) { console.error(e); }
  };

  const deleteTask = async (taskId) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE', headers: headers() });
      setSelectedTask(null);
      loadBoard();
    } catch (e) { console.error(e); }
  };

  // ---- COLUMN MANAGEMENT ----
  const addColumn = async () => {
    if (!newColName.trim() || !boardId) return;
    try {
      await fetch(`/api/boards/${boardId}/columns`, { method: 'POST', headers: headers(), body: JSON.stringify({ name: newColName.trim(), color: '#64748b' }) });
      setNewColName(''); setAddingColumn(false);
      loadBoard();
    } catch (e) { console.error(e); }
  };

  const renameColumn = async (colId) => {
    if (!renameValue.trim() || !boardId) return;
    try {
      await fetch(`/api/boards/${boardId}/columns`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ columnId: colId, name: renameValue.trim() }) });
      setRenamingCol(null);
      loadBoard();
    } catch (e) { console.error(e); }
  };

  const deleteColumn = async (colId) => {
    if (!boardId) return;
    if (!confirm('Delete this column and all its tasks?')) return;
    try {
      await fetch(`/api/boards/${boardId}/columns?columnId=${colId}`, { method: 'DELETE', headers: headers() });
      setColMenuOpen(null);
      loadBoard();
    } catch (e) { console.error(e); }
  };

  // ---- CONTEXT MENU ----
  const handleContextMenu = (e, task) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, task });
  };

  // ---- FILTERS ----
  const activeFilterCount = (filterPriority ? 1 : 0) + (filterAssignee ? 1 : 0) + (searchQuery ? 1 : 0);
  const clearFilters = () => { setFilterPriority(''); setFilterAssignee(''); setSearchQuery(''); };

  const filteredColumns = columns.map(col => ({
    ...col,
    tasks: col.tasks.filter(t => {
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterAssignee && t.assignee_id !== filterAssignee) return false;
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }),
  }));

  const totalTasks = columns.reduce((sum, c) => sum + c.tasks.length, 0);

  // ---- SKELETON LOADING ----
  if (loading) return <BoardSkeleton />;

  return (
    <div className="kb-page">
      {/* ======= BOARD HEADER ======= */}
      <div className="kb-header">
        <div className="kb-header-top">
          {/* Breadcrumbs */}
          <nav className="kb-breadcrumbs">
            <span className="kb-breadcrumb-item" onClick={() => router.push('/dashboard')}>
              <LayoutDashboard size={14} /> Dashboard
            </span>
            <ChevronRight size={14} className="kb-breadcrumb-sep" />
            <span className="kb-breadcrumb-item" onClick={() => router.push('/dashboard')}>
              <Columns3 size={14} /> Boards
            </span>
            <ChevronRight size={14} className="kb-breadcrumb-sep" />
            <span className="kb-breadcrumb-current">{board?.name || 'Board'}</span>
          </nav>
        </div>

        <div className="kb-header-main">
          <div className="kb-header-title-area">
            <div className="kb-project-badge" style={{ '--project-color': board?.color || '#6366f1' }}>
              {board?.icon ? board.icon : (board?.key || 'PJ').slice(0, 2)}
            </div>
            <div>
              <h1 className="kb-title">{board?.name || 'Board'}</h1>
              <div className="kb-subtitle">
                <span>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
                <span className="kb-subtitle-dot">·</span>
                <span>{columns.length} column{columns.length !== 1 ? 's' : ''}</span>
                {currentWorkspace && (
                  <>
                    <span className="kb-subtitle-dot">·</span>
                    <span>{currentWorkspace.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="kb-header-actions">
            {/* Project Settings */}
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => router.push(`/dashboard/board/${projectId}/settings`)}
            >
              <Settings size={14} /> Settings
            </button>

            {/* Filter Toggle */}
            <button
              className={`btn btn-secondary btn-sm kb-filter-btn ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && <span className="kb-filter-badge">{activeFilterCount}</span>}
            </button>

            {/* Create Task */}
            <button className="btn btn-primary btn-sm" onClick={() => { setCreateTaskColId(columns[0]?.id); setShowCreateTask(true); }}>
              <Plus size={14} /> Create Task
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        {showFilters && (
          <div className="kb-filter-bar">
            <div className="kb-filter-row">
              <div className="kb-filter-input-wrap">
                <Search size={14} />
                <input
                  className="kb-filter-input"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <select className="kb-filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                <option value="">All Priorities</option>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🔵 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
              <select className="kb-filter-select" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
                <option value="">All Assignees</option>
                {members.map(m => <option key={m.user_id || m.id} value={m.user_id || m.id}>{m.name || m.user_name}</option>)}
              </select>
              {activeFilterCount > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ color: 'var(--danger)', fontSize: 12 }}>
                  <X size={13} /> Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======= KANBAN BOARD ======= */}
      <div className="kb-board">
        <div className="kb-columns-scroll">
          {filteredColumns.map(col => {
            const isOver = dragOverCol === col.id;
            const wipLimit = col.wip_limit || 0;
            const isOverWip = wipLimit > 0 && col.tasks.length >= wipLimit;

            return (
              <div
                key={col.id}
                className={`kb-column ${isOver ? 'kb-column-dragover' : ''} ${isOverWip ? 'kb-column-wip-exceeded' : ''}`}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className="kb-col-header">
                  <div className="kb-col-header-left">
                    <div className="kb-col-dot" style={{ background: col.color }} />
                    {renamingCol === col.id ? (
                      <input
                        className="kb-col-rename-input"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') renameColumn(col.id); if (e.key === 'Escape') setRenamingCol(null); }}
                        onBlur={() => renameColumn(col.id)}
                        autoFocus
                      />
                    ) : (
                      <span className="kb-col-name">{col.name}</span>
                    )}
                    <span className="kb-col-count">{col.tasks.length}</span>
                    {wipLimit > 0 && (
                      <span className={`kb-wip-badge ${isOverWip ? 'exceeded' : ''}`}>
                        MAX {wipLimit}
                      </span>
                    )}
                  </div>
                  <div className="kb-col-actions">
                    <button className="kb-col-action-btn" onClick={() => { setCreateTaskColId(col.id); setShowCreateTask(true); }} title="Add task">
                      <Plus size={15} />
                    </button>
                    <div style={{ position: 'relative' }}>
                      <button className="kb-col-action-btn" onClick={() => setColMenuOpen(colMenuOpen === col.id ? null : col.id)} title="Column options">
                        <MoreVertical size={14} />
                      </button>
                      {colMenuOpen === col.id && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setColMenuOpen(null)} />
                          <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 100, minWidth: 160 }}>
                            <div className="dropdown-item" onClick={() => { setRenamingCol(col.id); setRenameValue(col.name); setColMenuOpen(null); }}>
                              <Pencil size={13} /> Rename
                            </div>
                            <div className="dropdown-item danger" onClick={() => { setColMenuOpen(null); deleteColumn(col.id); }}>
                              <Trash2 size={13} /> Delete
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column Body */}
                <div className="kb-col-body">
                  {col.tasks.length === 0 && !dragTaskId && (
                    <div className="kb-empty-col">
                      <Inbox size={28} strokeWidth={1.5} />
                      <span>No tasks</span>
                    </div>
                  )}

                  {col.tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      projectKey={board?.key || 'PL'}
                      highlighted={highlightedTaskId === task.id}
                      isDragging={dragTaskId === task.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={() => openTaskDetail(task)}
                      onContextMenu={(e) => handleContextMenu(e, task)}
                    />
                  ))}

                  {/* Drop Zone indicator */}
                  {isOver && dragTaskId && (
                    <div className="kb-drop-indicator">
                      <Plus size={14} /> Drop here
                    </div>
                  )}
                </div>

                {/* Column Footer - Quick Add */}
                <button className="kb-col-footer-btn" onClick={() => { setCreateTaskColId(col.id); setShowCreateTask(true); }}>
                  <Plus size={14} /> Add task
                </button>
              </div>
            );
          })}

          {/* Add Column */}
          <div className="kb-add-column-area">
            {addingColumn ? (
              <div className="kb-add-column-form">
                <input
                  className="input"
                  placeholder="Column name..."
                  value={newColName}
                  onChange={e => setNewColName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setAddingColumn(false); }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={addColumn}>Add</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAddingColumn(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="kb-add-column-btn" onClick={() => { setAddingColumn(true); setNewColName(''); }}>
                <Plus size={16} /> Add Column
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======= CONTEXT MENU ======= */}
      {contextMenu && (
        <div className="kb-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
          <div className="kb-context-item" onClick={() => { openTaskDetail(contextMenu.task); setContextMenu(null); }}>
            <Pencil size={13} /> Edit Task
          </div>
          <div className="kb-context-item" onClick={() => { setCreateTaskColId(contextMenu.task.column_id); setShowCreateTask(true); setContextMenu(null); }}>
            <Plus size={13} /> Add Task Here
          </div>
          <div className="kb-context-sep" />
          <div className="kb-context-item danger" onClick={() => { setConfirmDelete(contextMenu.task.id); setContextMenu(null); }}>
            <Trash2 size={13} /> Delete Task
          </div>
        </div>
      )}

      {/* ======= CREATE TASK MODAL ======= */}
      {showCreateTask && (
        <CreateTaskModal
          columns={columns}
          initialColumnId={createTaskColId}
          members={members}
          projectId={projectId}
          projectKey={board?.key || 'PL'}
          headers={headers}
          onClose={() => setShowCreateTask(false)}
          onCreated={() => { setShowCreateTask(false); loadBoard(); }}
        />
      )}

      {/* ======= TASK DETAIL PANEL ======= */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={updateTask}
          onDelete={(id) => setConfirmDelete(id)}
          onComment={addComment}
          members={members}
          columns={columns}
        />
      )}

      {/* ======= DELETE CONFIRMATION ======= */}
      {confirmDelete && (
        <>
          <div className="task-panel-overlay" style={{ zIndex: 400 }} onClick={() => setConfirmDelete(null)} />
          <div className="kb-confirm-modal">
            <div className="kb-confirm-icon"><Trash2 size={28} /></div>
            <h3>Delete this task?</h3>
            <p>This action cannot be undone. The task and all its data will be permanently removed.</p>
            <div className="kb-confirm-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { deleteTask(confirmDelete); setConfirmDelete(null); }}>Delete Task</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// TASK CARD COMPONENT
// ============================================================
function TaskCard({ task, projectKey, highlighted, isDragging, onDragStart, onDragEnd, onClick, onContextMenu }) {
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const PriorityIcon = pc.icon;

  const dueInfo = task.due_date ? (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date + 'T00:00:00');
    const isOverdue = due < today;
    const isDueToday = due.getTime() === today.getTime();
    const tmrw = new Date(today); tmrw.setDate(tmrw.getDate() + 1);
    const isTomorrow = due.getTime() === tmrw.getTime();
    const label = isOverdue ? 'Overdue' : isDueToday ? 'Today' : isTomorrow ? 'Tomorrow' : due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const cls = isOverdue ? 'overdue' : isDueToday ? 'due-today' : isTomorrow ? 'due-soon' : '';
    return { label, cls };
  })() : null;

  return (
    <div
      id={`task-${task.id}`}
      className={`kb-task ${highlighted ? 'kb-task-highlighted' : ''} ${isDragging ? 'kb-dragging' : ''}`}
      draggable
      onDragStart={e => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Top: Key + Priority */}
      <div className="kb-task-top">
        <span className="kb-task-key">{projectKey}-{task.position + 1}</span>
        <div className="kb-task-priority-dot" style={{ background: pc.color }} title={pc.label} />
      </div>

      {/* Title */}
      <div className="kb-task-title">{task.title}</div>

      {/* Labels */}
      {task.labels?.length > 0 && (
        <div className="kb-task-labels">
          {task.labels.map(l => (
            <span key={l.id} className="kb-task-label" style={{ '--label-color': l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="kb-task-footer">
        <div className="kb-task-meta">
          {/* Priority badge */}
          <span className="kb-task-priority-badge" style={{ background: pc.bg, color: pc.color }}>
            <PriorityIcon size={11} /> {pc.label}
          </span>

          {/* Due date */}
          {dueInfo && (
            <span className={`kb-task-due ${dueInfo.cls}`}>
              <Calendar size={11} /> {dueInfo.label}
            </span>
          )}

          {/* Story points */}
          {task.story_points > 0 && (
            <span className="kb-task-sp">{task.story_points}</span>
          )}

          {/* Comments */}
          {task.comment_count > 0 && (
            <span className="kb-task-comments">
              <MessageSquare size={11} /> {task.comment_count}
            </span>
          )}
        </div>

        {/* Assignee */}
        {task.assignee_name && (
          <div className="kb-task-assignee" title={task.assignee_name} style={{ background: getAvatarColor(task.assignee_name) }}>
            {getInitials(task.assignee_name)}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CREATE TASK MODAL
// ============================================================
function CreateTaskModal({ columns, initialColumnId, members, projectId, projectKey, headers, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [columnId, setColumnId] = useState(initialColumnId || columns[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [storyPoints, setStoryPoints] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!title.trim()) { setError('Task title is required'); return; }
    setError('');
    setSubmitting(true);
    try {
      const body = {
        column_id: columnId,
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assignee_id: assigneeId || undefined,
        due_date: dueDate || undefined,
        story_points: storyPoints ? parseInt(storyPoints) : undefined,
      };
      const res = await fetch('/api/tasks', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to create task');
        setSubmitting(false);
        return;
      }
      onCreated();
    } catch (err) {
      setError(err.message || 'Network error');
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="kb-create-modal">
        <div className="kb-create-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="kb-create-icon"><Plus size={18} /></div>
            <div>
              <h2>Create Task</h2>
              <span className="kb-create-project">{projectKey} · New Task</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form className="kb-create-body" onSubmit={handleSubmit}>
          {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

          {/* Title */}
          <div className="kb-create-field">
            <input
              ref={titleRef}
              className="kb-create-title-input"
              placeholder="What needs to be done?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="kb-create-field">
            <textarea
              className="input"
              placeholder="Add a description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Properties Grid */}
          <div className="kb-create-grid">
            <div className="kb-create-prop">
              <label><Columns3 size={13} /> Status</label>
              <select className="input" value={columnId} onChange={e => setColumnId(e.target.value)}>
                {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="kb-create-prop">
              <label><Flag size={13} /> Priority</label>
              <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="kb-create-prop">
              <label><User size={13} /> Assignee</label>
              <select className="input" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.user_id || m.id} value={m.user_id || m.id}>{m.name || m.user_name}</option>)}
              </select>
            </div>
            <div className="kb-create-prop">
              <label><Calendar size={13} /> Due Date</label>
              <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="kb-create-prop">
              <label><Zap size={13} /> Story Points</label>
              <input type="number" className="input" value={storyPoints} onChange={e => setStoryPoints(e.target.value)} min="0" max="100" placeholder="0" />
            </div>
          </div>
        </form>

        <div className="kb-create-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><Plus size={14} /> Create Task</>}
          </button>
        </div>
      </div>
    </>
  );
}


// ============================================================
// SKELETON LOADING
// ============================================================
function BoardSkeleton() {
  return (
    <div className="kb-page">
      <div className="kb-header">
        <div className="kb-header-top">
          <div className="skeleton" style={{ width: 240, height: 16, borderRadius: 4 }} />
        </div>
        <div className="kb-header-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 10 }} />
            <div>
              <div className="skeleton" style={{ width: 180, height: 22, marginBottom: 6, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 260, height: 14, borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="skeleton" style={{ width: 90, height: 34, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 110, height: 34, borderRadius: 6 }} />
          </div>
        </div>
      </div>
      <div className="kb-board">
        <div className="kb-columns-scroll">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="kb-column" style={{ opacity: 1 - (i * 0.1) }}>
              <div className="kb-col-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="skeleton" style={{ width: 10, height: 10, borderRadius: '50%' }} />
                  <div className="skeleton" style={{ width: 80, height: 14, borderRadius: 4 }} />
                  <div className="skeleton" style={{ width: 24, height: 18, borderRadius: 10 }} />
                </div>
              </div>
              <div className="kb-col-body">
                {[1, 2, 3].slice(0, Math.max(1, 4 - i)).map(j => (
                  <div key={j} className="kb-task" style={{ pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div className="skeleton" style={{ width: 48, height: 14, borderRadius: 4 }} />
                      <div className="skeleton" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                    </div>
                    <div className="skeleton" style={{ width: '90%', height: 16, marginBottom: 10, borderRadius: 4 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 10 }} />
                      <div className="skeleton" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
