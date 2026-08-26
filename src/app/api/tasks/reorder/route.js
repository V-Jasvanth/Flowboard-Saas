import { NextResponse } from 'next/server';

export async function PATCH(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { taskId, targetColumnId, newPosition } = await request.json();
    if (!taskId || !targetColumnId || newPosition === undefined)
      return NextResponse.json({ error: 'taskId, targetColumnId, and newPosition are required' }, { status: 400 });

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const oldColumnId = task.column_id;
    if (oldColumnId === targetColumnId) {
      if (newPosition > task.position) {
        await db.prepare('UPDATE tasks SET position = position - 1 WHERE column_id = ? AND position > ? AND position <= ?').run(targetColumnId, task.position, newPosition);
      } else {
        await db.prepare('UPDATE tasks SET position = position + 1 WHERE column_id = ? AND position >= ? AND position < ?').run(targetColumnId, newPosition, task.position);
      }
    } else {
      await db.prepare('UPDATE tasks SET position = position - 1 WHERE column_id = ? AND position > ?').run(oldColumnId, task.position);
      await db.prepare('UPDATE tasks SET position = position + 1 WHERE column_id = ? AND position >= ?').run(targetColumnId, newPosition);
    }
    await db.prepare('UPDATE tasks SET column_id = ?, position = ?, updated_at = ? WHERE id = ?').run(targetColumnId, newPosition, new Date().toISOString(), taskId);

    if (oldColumnId !== targetColumnId) {
      const oldCol = await db.prepare('SELECT name FROM columns WHERE id = ?').get(oldColumnId);
      const newCol = await db.prepare('SELECT name FROM columns WHERE id = ?').get(targetColumnId);
      const project = await db.prepare('SELECT workspace_id FROM projects WHERE id = ?').get(task.project_id);
      await db.prepare('INSERT INTO activity_log (id, workspace_id, project_id, task_id, user_id, action, details, created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(crypto.randomUUID(), project?.workspace_id, task.project_id, taskId, user.id, 'task_moved', JSON.stringify({ from: oldCol?.name, to: newCol?.name, taskTitle: task.title }), new Date().toISOString());
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/tasks/reorder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
