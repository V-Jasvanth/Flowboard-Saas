import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const { getDatabase } = require('@/lib/db');

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: boardId } = await params;
    const db = getDatabase();

    // Get board with project info
    const board = db.prepare(`
      SELECT b.*, p.workspace_id, p.name as project_name, p.key as project_key, p.color as project_color
      FROM boards b
      INNER JOIN projects p ON p.id = b.project_id
      WHERE b.id = ?
    `).get(boardId);

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Verify workspace membership
    const membership = db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(board.workspace_id, user.id);

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get columns for this board
    const columns = db.prepare(
      'SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC'
    ).all(boardId);

    // Get tasks for each column with assignee info
    const getTasksStmt = db.prepare(`
      SELECT t.*,
        assignee.name as assignee_name, assignee.email as assignee_email, assignee.avatar_url as assignee_avatar,
        reporter.name as reporter_name, reporter.email as reporter_email
      FROM tasks t
      LEFT JOIN users assignee ON assignee.id = t.assignee_id
      LEFT JOIN users reporter ON reporter.id = t.reporter_id
      WHERE t.column_id = ?
      ORDER BY t.position ASC
    `);

    const getTaskLabelsStmt = db.prepare(`
      SELECT l.* FROM labels l
      INNER JOIN task_labels tl ON tl.label_id = l.id
      WHERE tl.task_id = ?
    `);

    const columnsWithTasks = columns.map(column => {
      const tasks = getTasksStmt.all(column.id);
      const tasksWithLabels = tasks.map(task => ({
        ...task,
        labels: getTaskLabelsStmt.all(task.id),
      }));
      return {
        ...column,
        tasks: tasksWithLabels,
      };
    });

    return NextResponse.json({
      board: {
        id: board.id,
        project_id: board.project_id,
        name: board.name,
        created_at: board.created_at,
        project_name: board.project_name,
        project_key: board.project_key,
        project_color: board.project_color,
        workspace_id: board.workspace_id,
      },
      columns: columnsWithTasks,
    });
  } catch (error) {
    console.error('Get board error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
