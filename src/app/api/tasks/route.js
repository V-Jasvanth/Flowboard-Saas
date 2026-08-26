import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { searchParams } = new URL(request.url);

    const projectId = searchParams.get('project_id');
    const columnId = searchParams.get('column_id');
    const assigneeId = searchParams.get('assignee_id');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');

    let query = `
      SELECT t.*, u.name as assignee_name, u.email as assignee_email,
             r.name as reporter_name, c.name as column_name, c.color as column_color
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users r ON t.reporter_id = r.id
      LEFT JOIN columns c ON t.column_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (projectId) { query += ' AND t.project_id = ?'; params.push(projectId); }
    if (columnId) { query += ' AND t.column_id = ?'; params.push(columnId); }
    if (assigneeId) { query += ' AND t.assignee_id = ?'; params.push(assigneeId); }
    if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
    if (search) { query += ' AND (t.title LIKE ? OR t.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    query += ' ORDER BY t.position ASC, t.created_at DESC';
    const tasks = db.prepare(query).all(...params);

    const taskIds = tasks.map(t => t.id);
    const labels = taskIds.length > 0
      ? db.prepare(`SELECT tl.task_id, l.* FROM task_labels tl JOIN labels l ON tl.label_id = l.id WHERE tl.task_id IN (${taskIds.map(() => '?').join(',')})`).all(...taskIds)
      : [];
    const commentCounts = taskIds.length > 0
      ? db.prepare(`SELECT task_id, COUNT(*) as count FROM comments WHERE task_id IN (${taskIds.map(() => '?').join(',')}) GROUP BY task_id`).all(...taskIds)
      : [];

    const labelMap = {};
    labels.forEach(l => { if (!labelMap[l.task_id]) labelMap[l.task_id] = []; labelMap[l.task_id].push(l); });
    const commentMap = {};
    commentCounts.forEach(c => { commentMap[c.task_id] = c.count; });

    const enriched = tasks.map(t => ({
      ...t,
      labels: labelMap[t.id] || [],
      comment_count: commentMap[t.id] || 0,
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const body = await request.json();
    const { column_id, project_id, title, description, priority, assignee_id, due_date, story_points, labels } = body;

    if (!column_id || !project_id || !title) {
      return NextResponse.json({ error: 'column_id, project_id, and title are required' }, { status: 400 });
    }

    const maxPos = db.prepare('SELECT MAX(position) as max FROM tasks WHERE column_id = ?').get(column_id);
    const position = (maxPos?.max ?? -1) + 1;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`INSERT INTO tasks (id, column_id, project_id, title, description, priority, status, assignee_id, reporter_id, due_date, position, story_points, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, column_id, project_id, title, description || '', priority || 'medium', assignee_id || null, user.id, due_date || null, position, story_points || 0, now, now);

    if (labels && labels.length > 0) {
      const insertLabel = db.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)');
      labels.forEach(labelId => insertLabel.run(id, labelId));
    }

    const project = db.prepare('SELECT workspace_id FROM projects WHERE id = ?').get(project_id);
    db.prepare('INSERT INTO activity_log (id, workspace_id, project_id, task_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), project?.workspace_id, project_id, id, user.id, 'task_created', JSON.stringify({ taskTitle: title }), now);

    if (assignee_id && assignee_id !== user.id) {
      db.prepare('INSERT INTO notifications (id, user_id, workspace_id, type, title, message, read, link, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
        .run(crypto.randomUUID(), assignee_id, project?.workspace_id, 'task_assigned', 'Task Assigned', `You have been assigned to "${title}"`, `/dashboard/board/${project_id}?highlight=${id}`, now);
        
      if (due_date) {
        const dateStr = new Date(due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        db.prepare('INSERT INTO notifications (id, user_id, workspace_id, type, title, message, read, link, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
          .run(crypto.randomUUID(), assignee_id, project?.workspace_id, 'due_date', 'Due Date Set', `The due date for "${title}" is ${dateStr}`, `/dashboard/board/${project_id}?highlight=${id}`, now);
      }
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
