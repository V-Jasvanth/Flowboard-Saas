import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });

    // Tasks by column (status)
    const tasksByStatus = db.prepare(`
      SELECT c.name as status, c.color, COUNT(t.id) as count FROM columns c
      LEFT JOIN tasks t ON t.column_id = c.id
      JOIN boards b ON c.board_id = b.id
      JOIN projects p ON b.project_id = p.id
      WHERE p.workspace_id = ?
      GROUP BY c.id ORDER BY c.position
    `).all(workspaceId);

    // Tasks by priority
    const tasksByPriority = db.prepare(`
      SELECT t.priority, COUNT(*) as count FROM tasks t
      JOIN projects p ON t.project_id = p.id WHERE p.workspace_id = ? GROUP BY t.priority
    `).all(workspaceId);

    // Tasks by assignee
    const tasksByAssignee = db.prepare(`
      SELECT u.name, COUNT(t.id) as count FROM tasks t
      JOIN members m ON t.assignee_id = m.user_id AND m.workspace_id = ?
      JOIN users u ON m.user_id = u.id
      JOIN projects p ON t.project_id = p.id WHERE p.workspace_id = ? 
      GROUP BY t.assignee_id
    `).all(workspaceId, workspaceId);

    // Totals
    const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks t JOIN projects p ON t.project_id = p.id WHERE p.workspace_id = ?').get(workspaceId)?.count || 0;
    const doneColumns = db.prepare(`SELECT c.id FROM columns c JOIN boards b ON c.board_id = b.id JOIN projects p ON b.project_id = p.id WHERE p.workspace_id = ? AND LOWER(c.name) = 'done'`).all(workspaceId);
    const doneIds = doneColumns.map(c => c.id);
    const completedTasks = doneIds.length > 0
      ? db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE column_id IN (${doneIds.map(() => '?').join(',')})`).get(...doneIds)?.count || 0
      : 0;

    const inProgressCols = db.prepare(`SELECT c.id FROM columns c JOIN boards b ON c.board_id = b.id JOIN projects p ON b.project_id = p.id WHERE p.workspace_id = ? AND LOWER(c.name) LIKE '%progress%'`).all(workspaceId);
    const ipIds = inProgressCols.map(c => c.id);
    const inProgressTasks = ipIds.length > 0
      ? db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE column_id IN (${ipIds.map(() => '?').join(',')})`).get(...ipIds)?.count || 0
      : 0;

    // Overdue tasks (have due_date in the past and not in done columns)
    const today = new Date().toISOString().split('T')[0];
    const overdueTasks = doneIds.length > 0
      ? db.prepare(`SELECT COUNT(*) as count FROM tasks t JOIN projects p ON t.project_id = p.id WHERE p.workspace_id = ? AND t.due_date IS NOT NULL AND t.due_date < ? AND t.column_id NOT IN (${doneIds.map(() => '?').join(',')})`).get(workspaceId, today, ...doneIds)?.count || 0
      : db.prepare('SELECT COUNT(*) as count FROM tasks t JOIN projects p ON t.project_id = p.id WHERE p.workspace_id = ? AND t.due_date IS NOT NULL AND t.due_date < ?').get(workspaceId, today)?.count || 0;

    // Team size from workspace members
    const teamSize = db.prepare('SELECT COUNT(*) as count FROM members WHERE workspace_id = ?').get(workspaceId)?.count || 0;

    // Completed over time (last 30 days based on real task data)
    const completedOverTime = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      const doneCount = doneIds.length > 0
        ? db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE column_id IN (${doneIds.map(() => '?').join(',')}) AND updated_at >= ? AND updated_at < ?`).get(...doneIds, dateStr, nextDateStr)?.count || 0
        : 0;
      completedOverTime.push({ date: dateStr, count: doneCount });
    }

    // Average completion days (based on tasks in done columns)
    let averageCompletionDays = 0;
    if (doneIds.length > 0) {
      const doneTasks = db.prepare(`SELECT created_at, updated_at FROM tasks WHERE column_id IN (${doneIds.map(() => '?').join(',')})`).all(...doneIds);
      if (doneTasks.length > 0) {
        const totalDays = doneTasks.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime();
          const updated = new Date(t.updated_at).getTime();
          return sum + Math.max(1, Math.round((updated - created) / 86400000));
        }, 0);
        averageCompletionDays = Math.round((totalDays / doneTasks.length) * 10) / 10;
      }
    }

    return NextResponse.json({
      tasksByStatus,
      tasksByPriority,
      tasksByAssignee,
      completedOverTime,
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      openTasks: totalTasks - completedTasks,
      teamSize,
      averageCompletionDays,
    });
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
