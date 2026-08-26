'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Trash2, Pencil, Check, ChevronDown, Calendar, Clock, User, Users,
  Flag, Tag, Zap, MessageSquare, Activity, Paperclip, Upload, Hash,
  AlertTriangle, ArrowUpCircle, ArrowDownCircle, MinusCircle,
  MoreHorizontal, Copy, ExternalLink, Send, Bold, Italic, List,
  Code, Link2, FileText, Image as ImageIcon, CheckSquare, Plus, Save,
  Columns3
} from 'lucide-react';

// ============================================================
// CONFIG
// ============================================================
const PRIORITY_CONFIG = {
  critical: { icon: AlertTriangle,   color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Critical' },
  high:     { icon: ArrowUpCircle,   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'High' },
  medium:   { icon: MinusCircle,     color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  label: 'Medium' },
  low:      { icon: ArrowDownCircle, color: '#64748b', bg: 'rgba(100,116,139,0.15)', label: 'Low' },
};

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#22c55e','#f59e0b','#ef4444','#ec4899','#14b8a6'];
function getAvatarColor(name) { return AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length]; }
function getInitials(name) { return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2); }

function timeAgo(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getDueStatus(dueDate) {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, cls: 'overdue', color: '#ef4444' };
  if (diff === 0) return { label: 'Due today', cls: 'due-today', color: '#f59e0b' };
  if (diff === 1) return { label: 'Due tomorrow', cls: 'due-soon', color: '#06b6d4' };
  if (diff <= 7) return { label: `${diff}d left`, cls: 'due-soon', color: '#06b6d4' };
  return { label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: '', color: 'var(--text-muted)' };
}

// ============================================================
// ACTIVITY ICON MAPPING
// ============================================================
function getActivityIcon(action) {
  switch (action) {
    case 'task_created':  return { icon: CheckSquare,   color: '#22c55e' };
    case 'task_moved':    return { icon: ArrowUpCircle,  color: '#6366f1' };
    case 'task_updated':  return { icon: Pencil,         color: '#f59e0b' };
    case 'task_deleted':  return { icon: Trash2,         color: '#ef4444' };
    case 'comment_added': return { icon: MessageSquare,  color: '#06b6d4' };
    case 'task_assigned': return { icon: User,           color: '#8b5cf6' };
    default:              return { icon: Activity,       color: 'var(--text-muted)' };
  }
}

function getActivityText(action, details) {
  switch (action) {
    case 'task_moved':
      return <>moved {details.from && <span className="td-act-highlight">from {details.from}</span>} {details.to && <span className="td-act-highlight">to {details.to}</span>}</>;
    case 'comment_added': return 'added a comment';
    case 'task_created':  return 'created this task';
    case 'task_updated':
      return <>updated <span className="td-act-highlight">{details.field || 'task'}</span></>;
    case 'task_deleted':  return 'deleted a task';
    case 'task_assigned':
      return <>assigned to <span className="td-act-highlight">{details.assignee || 'someone'}</span></>;
    default: return action?.replace(/_/g, ' ') || 'performed an action';
  }
}

// ============================================================
// CLOSE ANIMATION DURATION (ms)
// ============================================================
const CLOSE_ANIM_MS = 280;

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function TaskDetailPanel({ task, onClose, onUpdate, onDelete, onComment, members, columns }) {
  // ----- Closing animation state -----
  const [isClosing, setIsClosing] = useState(false);
  const closingTimer = useRef(null);

  const triggerClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    closingTimer.current = setTimeout(() => {
      onClose();
    }, CLOSE_ANIM_MS);
  }, [isClosing, onClose]);

  useEffect(() => {
    return () => { if (closingTimer.current) clearTimeout(closingTimer.current); };
  }, []);

  // ----- General UI state -----
  const [activeTab, setActiveTab] = useState('comments');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [descValue, setDescValue] = useState(task.description || '');
  const [descEditing, setDescEditing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [saving, setSaving] = useState({});
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [copied, setCopied] = useState(false);

  // ----- Dirty tracking for title & description -----
  const titleDirty = titleValue.trim() !== '' && titleValue !== task.title;
  const descDirty = descValue !== (task.description || '');
  const hasDirtyFields = titleDirty || descDirty;
  const [batchSaving, setBatchSaving] = useState(false);

  // ----- Refs -----
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const commentRef = useRef(null);
  const panelRef = useRef(null);

  // ----- Sync props → state -----
  useEffect(() => {
    setTitleValue(task.title);
    setDescValue(task.description || '');
  }, [task.id, task.title, task.description]);

  // ----- Focus title on edit -----
  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [editingTitle]);

  // ----- Close pickers on outside click -----
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.td-picker-dropdown') && !e.target.closest('.td-field-value') && !e.target.closest('.td-add-label-btn')) {
        setShowLabelPicker(false);
        setShowPriorityPicker(false);
        setShowStatusPicker(false);
        setShowAssigneePicker(false);
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ----- Escape to close (respects editing state) -----
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        // If a picker is open, close that first
        if (showStatusPicker || showPriorityPicker || showAssigneePicker || showLabelPicker || showMoreMenu) {
          setShowStatusPicker(false);
          setShowPriorityPicker(false);
          setShowAssigneePicker(false);
          setShowLabelPicker(false);
          setShowMoreMenu(false);
          return;
        }
        // If editing title, cancel
        if (editingTitle) {
          setTitleValue(task.title);
          setEditingTitle(false);
          return;
        }
        // If editing description, cancel
        if (descEditing) {
          setDescValue(task.description || '');
          setDescEditing(false);
          return;
        }
        triggerClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [triggerClose, showStatusPicker, showPriorityPicker, showAssigneePicker, showLabelPicker, showMoreMenu, editingTitle, descEditing, task.title, task.description]);

  // ---- IMMEDIATE UPDATE (for pickers / dropdowns) ----
  const handleUpdate = async (field, value) => {
    setSaving(s => ({ ...s, [field]: true }));
    try {
      await onUpdate(field, value);
    } finally {
      setSaving(s => ({ ...s, [field]: false }));
    }
  };

  // ---- BATCH SAVE (title + description) ----
  const handleBatchSave = async () => {
    setBatchSaving(true);
    try {
      const promises = [];
      if (titleDirty) {
        promises.push(onUpdate('title', titleValue.trim()));
      }
      if (descDirty) {
        promises.push(onUpdate('description', descValue));
      }
      await Promise.all(promises);
      setEditingTitle(false);
      setDescEditing(false);
    } finally {
      setBatchSaving(false);
    }
  };

  // ---- Title inline-edit blur handler (does NOT auto-save, just exits edit mode) ----
  const handleTitleBlur = () => {
    // Keep the value in the input for the Save button, just exit inline mode
    if (!titleValue.trim()) {
      setTitleValue(task.title);
    }
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!titleValue.trim()) setTitleValue(task.title);
      setEditingTitle(false);
    }
    if (e.key === 'Escape') {
      setTitleValue(task.title);
      setEditingTitle(false);
    }
  };

  // ---- Comment handler ----
  const handleComment = async () => {
    if (!commentText.trim()) return;
    setCommentSubmitting(true);
    try {
      await onComment(commentText);
      setCommentText('');
    } finally {
      setCommentSubmitting(false);
    }
  };

  // ---- Label toggle ----
  const handleLabelToggle = (labelId) => {
    const currentLabels = (task.labels || []).map(l => l.id);
    const newLabels = currentLabels.includes(labelId)
      ? currentLabels.filter(id => id !== labelId)
      : [...currentLabels, labelId];
    handleUpdate('labels', newLabels);
  };

  // ---- Copy task key ----
  const copyTaskId = () => {
    const taskKey = `${task.column_name || 'TASK'}-${task.id?.slice(0, 6)}`;
    navigator.clipboard?.writeText(taskKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---- Derived values ----
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const PriorityIcon = pc.icon;
  const dueStatus = getDueStatus(task.due_date);
  const currentColumn = columns.find(c => c.id === task.column_id);
  const assignee = members.find(m => (m.user_id || m.id) === task.assignee_id);
  const taskLabels = task.labels || [];

  return (
    <>
      {/* ===== OVERLAY ===== */}
      <div
        className={`td-overlay ${isClosing ? 'td-overlay-closing' : ''}`}
        onClick={triggerClose}
      />

      {/* ===== PANEL ===== */}
      <div
        className={`td-panel ${isClosing ? 'td-panel-closing' : ''}`}
        ref={panelRef}
      >
        {/* ===== HEADER (fixed) ===== */}
        <div className="td-header">
          <div className="td-header-left">
            <div className="td-task-key-badge" onClick={copyTaskId} title="Copy task ID">
              <Hash size={12} />
              <span>{task.id?.slice(0, 8)}</span>
              {copied && <span className="td-copied-toast">Copied!</span>}
            </div>
            {currentColumn && (
              <div className="td-status-pill" style={{ '--col-color': currentColumn.color }}>
                <span className="td-status-dot" style={{ background: currentColumn.color }} />
                {currentColumn.name}
              </div>
            )}
          </div>
          <div className="td-header-right">
            <div style={{ position: 'relative' }}>
              <button className="td-header-btn" onClick={() => setShowMoreMenu(!showMoreMenu)} title="More actions">
                <MoreHorizontal size={16} />
              </button>
              {showMoreMenu && (
                <div className="td-picker-dropdown" style={{ right: 0, top: 'calc(100% + 4px)', minWidth: 180 }}>
                  <div className="td-picker-item" onClick={() => { copyTaskId(); setShowMoreMenu(false); }}>
                    <Copy size={13} /> Copy Task ID
                  </div>
                  <div className="td-picker-sep" />
                  <div className="td-picker-item danger" onClick={() => { onDelete(task.id); setShowMoreMenu(false); }}>
                    <Trash2 size={13} /> Delete Task
                  </div>
                </div>
              )}
            </div>
            <button className="td-header-btn td-close-btn" onClick={triggerClose} title="Close panel">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ===== SCROLLABLE BODY ===== */}
        <div className="td-body">
          {/* ---- TITLE ---- */}
          <div className="td-title-area">
            {editingTitle ? (
              <input
                ref={titleRef}
                className="td-title-input"
                value={titleValue}
                onChange={e => setTitleValue(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
              />
            ) : (
              <h1 className="td-title" onClick={() => setEditingTitle(true)}>
                {titleDirty ? titleValue : task.title}
                <Pencil size={14} className="td-title-edit-icon" />
              </h1>
            )}
            {titleDirty && !editingTitle && (
              <span className="td-unsaved-indicator">Unsaved</span>
            )}
          </div>

          {/* ---- PROPERTIES GRID ---- */}
          <div className="td-properties">
            <h3 className="td-section-label"><FileText size={13} /> Details</h3>

            {/* Status */}
            <div className="td-field">
              <span className="td-field-label"><Columns3 size={13} /> Status</span>
              <div className="td-field-value-wrap">
                <button className="td-field-value" onClick={() => setShowStatusPicker(!showStatusPicker)}>
                  {currentColumn && <span className="td-status-dot-sm" style={{ background: currentColumn.color }} />}
                  <span>{currentColumn?.name || 'Select'}</span>
                  <ChevronDown size={13} className="td-field-chevron" />
                  {saving.column_id && <span className="td-saving-dot" />}
                </button>
                {showStatusPicker && (
                  <div className="td-picker-dropdown">
                    {columns.map(c => (
                      <div
                        key={c.id}
                        className={`td-picker-item ${c.id === task.column_id ? 'active' : ''}`}
                        onClick={() => { handleUpdate('column_id', c.id); setShowStatusPicker(false); }}
                      >
                        <span className="td-status-dot-sm" style={{ background: c.color }} />
                        {c.name}
                        {c.id === task.column_id && <Check size={14} className="td-picker-check" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Priority */}
            <div className="td-field">
              <span className="td-field-label"><Flag size={13} /> Priority</span>
              <div className="td-field-value-wrap">
                <button className="td-field-value" onClick={() => setShowPriorityPicker(!showPriorityPicker)}>
                  <PriorityIcon size={14} style={{ color: pc.color }} />
                  <span>{pc.label}</span>
                  <ChevronDown size={13} className="td-field-chevron" />
                  {saving.priority && <span className="td-saving-dot" />}
                </button>
                {showPriorityPicker && (
                  <div className="td-picker-dropdown">
                    {Object.entries(PRIORITY_CONFIG).map(([key, val]) => {
                      const Icon = val.icon;
                      return (
                        <div
                          key={key}
                          className={`td-picker-item ${key === task.priority ? 'active' : ''}`}
                          onClick={() => { handleUpdate('priority', key); setShowPriorityPicker(false); }}
                        >
                          <Icon size={14} style={{ color: val.color }} />
                          <span>{val.label}</span>
                          {key === task.priority && <Check size={14} className="td-picker-check" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Assignee */}
            <div className="td-field">
              <span className="td-field-label"><User size={13} /> Assignee</span>
              <div className="td-field-value-wrap">
                <button className="td-field-value" onClick={() => setShowAssigneePicker(!showAssigneePicker)}>
                  {assignee ? (
                    <>
                      <div className="td-mini-avatar" style={{ background: getAvatarColor(assignee.name || assignee.user_name) }}>
                        {getInitials(assignee.name || assignee.user_name)}
                      </div>
                      <span>{assignee.name || assignee.user_name}</span>
                    </>
                  ) : (
                    <span className="td-field-placeholder">Unassigned</span>
                  )}
                  <ChevronDown size={13} className="td-field-chevron" />
                  {saving.assignee_id && <span className="td-saving-dot" />}
                </button>
                {showAssigneePicker && (
                  <div className="td-picker-dropdown">
                    <div
                      className={`td-picker-item ${!task.assignee_id ? 'active' : ''}`}
                      onClick={() => { handleUpdate('assignee_id', null); setShowAssigneePicker(false); }}
                    >
                      <div className="td-mini-avatar" style={{ background: 'var(--bg-elevated)' }}>
                        <User size={10} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <span>Unassigned</span>
                      {!task.assignee_id && <Check size={14} className="td-picker-check" />}
                    </div>
                    <div className="td-picker-sep" />
                    {members.map(m => {
                      const mid = m.user_id || m.id;
                      const mname = m.name || m.user_name;
                      return (
                        <div
                          key={mid}
                          className={`td-picker-item ${mid === task.assignee_id ? 'active' : ''}`}
                          onClick={() => { handleUpdate('assignee_id', mid); setShowAssigneePicker(false); }}
                        >
                          <div className="td-mini-avatar" style={{ background: getAvatarColor(mname) }}>
                            {getInitials(mname)}
                          </div>
                          <span>{mname}</span>
                          {mid === task.assignee_id && <Check size={14} className="td-picker-check" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div className="td-field">
              <span className="td-field-label"><Calendar size={13} /> Due Date</span>
              <div className="td-field-value-wrap">
                <div className="td-date-field">
                  <input
                    type="date"
                    className="td-date-input"
                    value={task.due_date || ''}
                    onChange={e => handleUpdate('due_date', e.target.value || null)}
                  />
                  <div className="td-date-display">
                    {dueStatus ? (
                      <span className={`td-due-label ${dueStatus.cls}`} style={{ color: dueStatus.color }}>
                        <Calendar size={12} /> {dueStatus.label}
                      </span>
                    ) : (
                      <span className="td-field-placeholder">No due date</span>
                    )}
                  </div>
                  {saving.due_date && <span className="td-saving-dot" />}
                </div>
              </div>
            </div>

            {/* Story Points */}
            <div className="td-field">
              <span className="td-field-label"><Zap size={13} /> Story Points</span>
              <div className="td-field-value-wrap">
                <input
                  type="number"
                  className="td-sp-input"
                  value={task.story_points ?? ''}
                  placeholder="—"
                  min={0}
                  max={100}
                  onChange={e => handleUpdate('story_points', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                />
                {saving.story_points && <span className="td-saving-dot" />}
              </div>
            </div>

            {/* Reporter (display only) */}
            <div className="td-field">
              <span className="td-field-label"><Users size={13} /> Reporter</span>
              <div className="td-field-value-wrap">
                {task.reporter_name ? (
                  <div className="td-reporter-display">
                    <div className="td-mini-avatar" style={{ background: getAvatarColor(task.reporter_name) }}>
                      {getInitials(task.reporter_name)}
                    </div>
                    <span>{task.reporter_name}</span>
                  </div>
                ) : (
                  <span className="td-field-placeholder">No reporter</span>
                )}
              </div>
            </div>

            {/* Labels */}
            <div className="td-field td-field-labels">
              <span className="td-field-label"><Tag size={13} /> Labels</span>
              <div className="td-field-value-wrap">
                <div className="td-labels-area">
                  {taskLabels.length > 0 && (
                    <div className="td-label-chips">
                      {taskLabels.map(l => (
                        <span key={l.id} className="td-label-chip" style={{ '--label-color': l.color }}>
                          {l.name}
                          <button className="td-label-remove" onClick={(e) => { e.stopPropagation(); handleLabelToggle(l.id); }}>
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <button className="td-add-label-btn" onClick={() => setShowLabelPicker(!showLabelPicker)}>
                    <Plus size={12} /> {taskLabels.length === 0 ? 'Add label' : 'Add'}
                  </button>
                </div>
                {showLabelPicker && (
                  <LabelPicker
                    taskLabels={taskLabels}
                    projectId={task.project_id}
                    onToggle={handleLabelToggle}
                    onClose={() => setShowLabelPicker(false)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* ---- DESCRIPTION ---- */}
          <div className="td-section">
            <div className="td-section-header">
              <h3 className="td-section-label"><FileText size={13} /> Description</h3>
              {!descEditing && (
                <button
                  className="td-section-edit-btn"
                  onClick={() => { setDescEditing(true); setTimeout(() => descRef.current?.focus(), 50); }}
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
            {descEditing ? (
              <div className="td-desc-editor">
                <div className="td-desc-toolbar">
                  <button className="td-desc-tool" title="Bold"><Bold size={14} /></button>
                  <button className="td-desc-tool" title="Italic"><Italic size={14} /></button>
                  <button className="td-desc-tool" title="List"><List size={14} /></button>
                  <button className="td-desc-tool" title="Code"><Code size={14} /></button>
                  <button className="td-desc-tool" title="Link"><Link2 size={14} /></button>
                </div>
                <textarea
                  ref={descRef}
                  className="td-desc-textarea"
                  value={descValue}
                  onChange={e => setDescValue(e.target.value)}
                  placeholder={"Add a detailed description...\n\nUse markdown for formatting."}
                  rows={6}
                />
                <div className="td-desc-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setDescValue(task.description || ''); setDescEditing(false); }}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setDescEditing(false)}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="td-desc-display"
                onClick={() => { setDescEditing(true); setTimeout(() => descRef.current?.focus(), 50); }}
              >
                {(descDirty ? descValue : task.description) ? (
                  <p className="td-desc-text">{descDirty ? descValue : task.description}</p>
                ) : (
                  <p className="td-desc-placeholder">Click to add a description...</p>
                )}
                {descDirty && <span className="td-unsaved-indicator">Unsaved</span>}
              </div>
            )}
          </div>

          {/* ---- ATTACHMENTS ---- */}
          <div className="td-section">
            <h3 className="td-section-label"><Paperclip size={13} /> Attachments</h3>
            <div className="td-attachments-empty">
              <Upload size={20} />
              <span>Drop files here or click to attach</span>
              <span className="td-attachment-hint">PNG, JPG, PDF up to 10MB</span>
            </div>
          </div>

          {/* ---- TABS: COMMENTS / ACTIVITY ---- */}
          <div className="td-tabs-section">
            <div className="td-tabs">
              <button
                className={`td-tab ${activeTab === 'comments' ? 'active' : ''}`}
                onClick={() => setActiveTab('comments')}
              >
                <MessageSquare size={13} /> Comments
                {task.comments?.length > 0 && <span className="td-tab-count">{task.comments.length}</span>}
              </button>
              <button
                className={`td-tab ${activeTab === 'activity' ? 'active' : ''}`}
                onClick={() => setActiveTab('activity')}
              >
                <Activity size={13} /> Activity
                {task.activity?.length > 0 && <span className="td-tab-count">{task.activity.length}</span>}
              </button>
            </div>

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div className="td-tab-content">
                {/* Comment Input */}
                <div className="td-comment-input-area">
                  <div className="td-comment-avatar" style={{ background: getAvatarColor('You') }}>
                    Y
                  </div>
                  <div className="td-comment-input-wrap">
                    <textarea
                      ref={commentRef}
                      className="td-comment-textarea"
                      placeholder="Add a comment... (Enter to send)"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleComment();
                        }
                      }}
                      rows={1}
                    />
                    <button
                      className="td-comment-send"
                      onClick={handleComment}
                      disabled={!commentText.trim() || commentSubmitting}
                      title="Send comment"
                    >
                      {commentSubmitting
                        ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        : <Send size={14} />
                      }
                    </button>
                  </div>
                </div>

                {/* Comment List */}
                <div className="td-comments-list">
                  {(!task.comments || task.comments.length === 0) && (
                    <div className="td-empty-tab">
                      <MessageSquare size={24} strokeWidth={1.5} />
                      <span>No comments yet</span>
                      <span className="td-empty-hint">Be the first to add a comment</span>
                    </div>
                  )}
                  {task.comments?.map(c => (
                    <div key={c.id} className="td-comment">
                      <div className="td-comment-avatar" style={{ background: getAvatarColor(c.user_name) }}>
                        {getInitials(c.user_name)}
                      </div>
                      <div className="td-comment-body">
                        <div className="td-comment-header">
                          <strong>{c.user_name}</strong>
                          <span className="td-comment-time">{timeAgo(c.created_at)}</span>
                        </div>
                        <div className="td-comment-text">{c.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="td-tab-content">
                <div className="td-activity-list">
                  {(!task.activity || task.activity.length === 0) && (
                    <div className="td-empty-tab">
                      <Activity size={24} strokeWidth={1.5} />
                      <span>No activity yet</span>
                    </div>
                  )}
                  {(showAllActivity ? task.activity : task.activity?.slice(0, 10))?.map(a => {
                    let details = {};
                    try { details = JSON.parse(a.details || '{}'); } catch {}
                    const ai = getActivityIcon(a.action);
                    const ActivityIcon = ai.icon;
                    return (
                      <div key={a.id} className="td-activity">
                        <div className="td-activity-icon" style={{ background: ai.color + '18', color: ai.color }}>
                          <ActivityIcon size={12} />
                        </div>
                        <div className="td-activity-body">
                          <span className="td-activity-text">
                            <strong>{a.user_name}</strong> {getActivityText(a.action, details)}
                          </span>
                          <span className="td-activity-time">{timeAgo(a.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {task.activity?.length > 10 && !showAllActivity && (
                    <button className="td-show-more" onClick={() => setShowAllActivity(true)}>
                      Show all {task.activity.length} activities
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ---- METADATA ---- */}
          <div className="td-metadata">
            <div className="td-meta-row">
              <span>Created</span>
              <span>{formatDate(task.created_at)}</span>
            </div>
            <div className="td-meta-row">
              <span>Updated</span>
              <span>{formatDate(task.updated_at)}</span>
            </div>
            <div className="td-meta-row">
              <span>Task ID</span>
              <span className="td-meta-mono">{task.id?.slice(0, 12)}...</span>
            </div>
          </div>
        </div>

        {/* ===== FOOTER (fixed) ===== */}
        <div className="td-footer">
          <div className="td-footer-left">
            <button
              className="btn btn-sm"
              style={{
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                border: '1px solid rgba(239,68,68,0.2)',
                gap: 6,
              }}
              onClick={() => onDelete(task.id)}
              title="Delete task"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
          <div className="td-footer-right">
            {hasDirtyFields && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBatchSave}
                disabled={batchSaving}
                style={{ gap: 6 }}
              >
                {batchSaving ? (
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                ) : (
                  <Save size={14} />
                )}
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// LABEL PICKER (fetches project labels)
// ============================================================
function LabelPicker({ taskLabels, projectId, onToggle, onClose }) {
  const [allLabels, setAllLabels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLabels() {
      try {
        const token = document.cookie.split(';').find(c => c.trim().startsWith('flowboard-token='))?.split('=')?.[1];
        const res = await fetch(`/api/projects/${projectId}`, {
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
        });
        if (res.ok) {
          const data = await res.json();
          setAllLabels(data.labels || []);
        }
      } catch (e) {
        console.error('fetch labels:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchLabels();
  }, [projectId]);

  const assignedIds = taskLabels.map(l => l.id);

  return (
    <div className="td-picker-dropdown td-label-picker">
      <div className="td-picker-header">
        <span>Labels</span>
        <button className="td-picker-close" onClick={onClose}><X size={14} /></button>
      </div>
      {loading ? (
        <div style={{ padding: 16, textAlign: 'center' }}><span className="spinner spinner-sm" /></div>
      ) : allLabels.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No labels in project</div>
      ) : (
        <div className="td-label-picker-list">
          {allLabels.map(l => (
            <div
              key={l.id}
              className={`td-picker-item ${assignedIds.includes(l.id) ? 'active' : ''}`}
              onClick={() => onToggle(l.id)}
            >
              <span className="td-label-color-dot" style={{ background: l.color }} />
              <span>{l.name}</span>
              {assignedIds.includes(l.id) && <Check size={14} className="td-picker-check" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
