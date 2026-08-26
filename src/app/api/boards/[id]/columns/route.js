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

    // Verify board exists and user has access
    const board = await db.prepare(`
      SELECT b.*, p.workspace_id FROM boards b
      INNER JOIN projects p ON p.id = b.project_id
      WHERE b.id = ?
    `).get(boardId);

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(board.workspace_id, user.id);

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const columns = await db.prepare(
      'SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC'
    ).all(boardId);

    return NextResponse.json({ columns });
  } catch (error) {
    console.error('List columns error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const { getDatabase } = require('@/lib/db');

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: boardId } = await params;
    const db = getDatabase();

    // Verify board exists and user has access
    const board = await db.prepare(`
      SELECT b.*, p.workspace_id FROM boards b
      INNER JOIN projects p ON p.id = b.project_id
      WHERE b.id = ?
    `).get(boardId);

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(board.workspace_id, user.id);

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { name, color, wip_limit } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Column name is required' }, { status: 400 });
    }

    // Get the next position
    const maxPos = await db.prepare(
      'SELECT MAX(position) as max_pos FROM columns WHERE board_id = ?'
    ).get(boardId);
    const position = ((maxPos?.max_pos) ?? -1) + 1;

    const columnId = crypto.randomUUID();
    await db.prepare(
      'INSERT INTO columns (id, board_id, name, position, color, wip_limit) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(columnId, boardId, name.trim(), position, color || '#64748b', wip_limit || 0);

    const column = await db.prepare('SELECT * FROM columns WHERE id = ?').get(columnId);

    return NextResponse.json({ column }, { status: 201 });
  } catch (error) {
    console.error('Create column error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const { getDatabase } = require('@/lib/db');

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: boardId } = await params;
    const db = getDatabase();

    // Verify board exists and user has access
    const board = await db.prepare(`
      SELECT b.*, p.workspace_id FROM boards b
      INNER JOIN projects p ON p.id = b.project_id
      WHERE b.id = ?
    `).get(boardId);

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(board.workspace_id, user.id);

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { columnId, name, position, color, wip_limit } = await request.json();

    if (!columnId) {
      return NextResponse.json({ error: 'columnId is required' }, { status: 400 });
    }

    const column = await db.prepare(
      'SELECT * FROM columns WHERE id = ? AND board_id = ?'
    ).get(columnId, boardId);

    if (!column) {
      return NextResponse.json({ error: 'Column not found on this board' }, { status: 404 });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (position !== undefined) {
      // Reorder columns
      const currentPos = column.position;
      if (position !== currentPos) {
        if (position > currentPos) {
          await db.prepare(
            'UPDATE columns SET position = position - 1 WHERE board_id = ? AND position > ? AND position <= ?'
          ).run(boardId, currentPos, position);
        } else {
          await db.prepare(
            'UPDATE columns SET position = position + 1 WHERE board_id = ? AND position >= ? AND position < ?'
          ).run(boardId, position, currentPos);
        }
      }
      updates.push('position = ?');
      values.push(position);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    if (wip_limit !== undefined) {
      updates.push('wip_limit = ?');
      values.push(wip_limit);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(columnId);
    await db.prepare(`UPDATE columns SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedColumn = await db.prepare('SELECT * FROM columns WHERE id = ?').get(columnId);

    return NextResponse.json({ column: updatedColumn });
  } catch (error) {
    console.error('Update column error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const { getDatabase } = require('@/lib/db');

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: boardId } = await params;
    const db = getDatabase();

    // Verify board exists and user has access
    const board = await db.prepare(`
      SELECT b.*, p.workspace_id FROM boards b
      INNER JOIN projects p ON p.id = b.project_id
      WHERE b.id = ?
    `).get(boardId);

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(board.workspace_id, user.id);

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can delete columns' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const columnId = searchParams.get('columnId');
    const moveToColumnId = searchParams.get('moveToColumnId');

    if (!columnId) {
      return NextResponse.json({ error: 'columnId is required' }, { status: 400 });
    }

    const column = await db.prepare(
      'SELECT * FROM columns WHERE id = ? AND board_id = ?'
    ).get(columnId, boardId);

    if (!column) {
      return NextResponse.json({ error: 'Column not found on this board' }, { status: 404 });
    }

    if (moveToColumnId) {
      // Move tasks to another column
      const targetColumn = await db.prepare('SELECT * FROM columns WHERE id = ?').get(moveToColumnId);
      if (targetColumn) {
        const maxPos = await db.prepare(
          'SELECT MAX(position) as max_pos FROM tasks WHERE column_id = ?'
        ).get(moveToColumnId);
        let nextPos = ((maxPos?.max_pos) ?? -1) + 1;

        const tasks = await db.prepare('SELECT id FROM tasks WHERE column_id = ?').all(columnId);
        const updateTask = db.prepare('UPDATE tasks SET column_id = ?, position = ? WHERE id = ?');
        for (const task of tasks) {
          await updateTask.run(moveToColumnId, nextPos++, task.id);
        }
      }
    }
    // Delete the column
    await db.prepare('DELETE FROM columns WHERE id = ?').run(columnId);

    // Reorder remaining columns
    await db.prepare(
      'UPDATE columns SET position = position - 1 WHERE board_id = ? AND position > ?'
    ).run(boardId, column.position);

    return NextResponse.json({ message: 'Column deleted' });
  } catch (error) {
    console.error('Delete column error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
