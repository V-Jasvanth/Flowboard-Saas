import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { id } = await params;

    const task = await db.prepare(`
      SELECT t.*, u.name as assignee_name, u.email as assignee_email, u.avatar_url as assignee_avatar,
             r.name as reporter_name, r.email as reporter_email,
             c.name as column_name, c.color as column_color, c.board_id
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users r ON t.reporter_id = r.id
      LEFT JOIN columns c ON t.column_id = c.id
      WHERE t.id = ?
    `).get(id);

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const labels = await db.prepare('SELECT l.* FROM task_labels tl JOIN labels l ON tl.label_id = l.id WHERE tl.task_id = ?').all(id);
    const comments = await db.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
      FROM comments c JOIN users u ON c.user_id = u.id WHERE c.task_id = ? ORDER BY c.created_at ASC
    `).all(id);
    const activity = await db.prepare(`
      SELECT a.*, u.name as user_name FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id WHERE a.task_id = ? ORDER BY a.created_at DESC LIMIT 20
    `).all(id);

    return NextResponse.json({ ...task, labels, comments, activity });
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { id } = await params;
    const body = await request.json();
    const now = new Date().toISOString();

    const existing = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const fields = ['title', 'description', 'priority', 'status', 'assignee_id', 'column_id', 'due_date', 'story_points', 'position'];
    const updates = [];
    const values = [];
    const project = await db.prepare('SELECT workspace_id FROM projects WHERE id = ?').get(existing.project_id);

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
        if (field === 'column_id' && body[field] !== existing.column_id) {
          const oldCol = await db.prepare('SELECT name FROM columns WHERE id = ?').get(existing.column_id);
          const newCol = await db.prepare('SELECT name FROM columns WHERE id = ?').get(body[field]);
          await db.prepare('INSERT INTO activity_log (id, workspace_id, project_id, task_id, user_id, action, details, created_at) VALUES (?,?,?,?,?,?,?,?)')
            .run(crypto.randomUUID(), project?.workspace_id, existing.project_id, id, user.id, 'task_moved', JSON.stringify({ from: oldCol?.name, to: newCol?.name }), now);
          // Notify assignee about status change
          if (existing.assignee_id && existing.assignee_id !== user.id) {
            await db.prepare('INSERT INTO notifications (id, user_id, workspace_id, type, title, message, read, link, created_at) VALUES (?,?,?,?,?,?,0,?,?)')
              .run(crypto.randomUUID(), existing.assignee_id, project?.workspace_id, 'status_changed', 'Task Status Changed', `"${existing.title}" moved from ${oldCol?.name || 'unknown'} to ${newCol?.name || 'unknown'}`, `/dashboard/board/${existing.project_id}?highlight=${id}`, now);
          }
        }
        if (field === 'assignee_id' && body[field] !== existing.assignee_id && body[field]) {
          await db.prepare('INSERT INTO notifications (id, user_id, workspace_id, type, title, message, read, link, created_at) VALUES (?,?,?,?,?,?,0,?,?)')
            .run(crypto.randomUUID(), body[field], project?.workspace_id, 'task_assigned', 'Task Assigned', `You have been assigned to "${existing.title}"`, `/dashboard/board/${existing.project_id}?highlight=${id}`, now);
        }
        if (field === 'due_date' && body[field] !== existing.due_date && existing.assignee_id && existing.assignee_id !== user.id) {
          const dateStr = new Date(body[field]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          await db.prepare('INSERT INTO notifications (id, user_id, workspace_id, type, title, message, read, link, created_at) VALUES (?,?,?,?,?,?,0,?,?)')
            .run(crypto.randomUUID(), existing.assignee_id, project?.workspace_id, 'due_date', 'Due Date Updated', `The due date for "${existing.title}" is now ${dateStr}`, `/dashboard/board/${existing.project_id}?highlight=${id}`, now);
        }
      }
    }

    if (body.labels !== undefined) {
      await db.prepare('DELETE FROM task_labels WHERE task_id = ?').run(id);
      const ins = db.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)');
      for (const lid of body.labels) {
        await ins.run(id, lid);
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(now, id);
      await db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    return NextResponse.json(task);
  } catch (error) {
    console.error('PATCH /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { id } = await params;
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const project = await db.prepare('SELECT workspace_id FROM projects WHERE id = ?').get(task.project_id);
    await db.prepare('INSERT INTO activity_log (id, workspace_id, project_id, task_id, user_id, action, details, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), project?.workspace_id, task.project_id, null, user.id, 'task_deleted', JSON.stringify({ taskTitle: task.title }), new Date().toISOString());
    await db.prepare('DELETE FROM comments WHERE task_id = ?').run(id);
    await db.prepare('DELETE FROM task_labels WHERE task_id = ?').run(id);
    await db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
