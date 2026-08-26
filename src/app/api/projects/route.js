import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const { getDatabase } = require('@/lib/db');

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDatabase();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id query parameter is required' }, { status: 400 });
    }

    // Verify membership
    const membership = db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspaceId, user.id);

    if (!membership) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 });
    }

    const projects = db.prepare(`
      SELECT p.*,
        u.name as creator_name,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM boards WHERE project_id = p.id) as board_count
      FROM projects p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.workspace_id = ? AND (p.status IS NULL OR p.status != 'archived')
      ORDER BY p.created_at DESC
    `).all(workspaceId);

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('List projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const { getDatabase } = require('@/lib/db');

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspace_id, name, description, key, color } = await request.json();

    if (!workspace_id || !name || !key) {
      return NextResponse.json(
        { error: 'workspace_id, name, and key are required' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Verify membership
    const membership = db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspace_id, user.id);

    if (!membership) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 });
    }

    const projectId = crypto.randomUUID();
    const boardId = crypto.randomUUID();
    const now = new Date().toISOString();

    const createProject = db.transaction(() => {
      // Create the project
      db.prepare(
        'INSERT INTO projects (id, workspace_id, name, description, key, color, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(projectId, workspace_id, name.trim(), description || null, key.toUpperCase(), color || '#6366f1', user.id, now);

      // Create a default board
      db.prepare(
        'INSERT INTO boards (id, project_id, name, created_at) VALUES (?, ?, ?, ?)'
      ).run(boardId, projectId, 'Main Board', now);

      // Create default columns
      const defaultColumns = [
        { name: 'Backlog', position: 0, color: '#64748b', wipLimit: 0 },
        { name: 'To Do', position: 1, color: '#3b82f6', wipLimit: 5 },
        { name: 'In Progress', position: 2, color: '#f59e0b', wipLimit: 3 },
        { name: 'In Review', position: 3, color: '#8b5cf6', wipLimit: 3 },
        { name: 'Done', position: 4, color: '#22c55e', wipLimit: 0 },
      ];

      const insertColumn = db.prepare(
        'INSERT INTO columns (id, board_id, name, position, color, wip_limit) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const col of defaultColumns) {
        insertColumn.run(crypto.randomUUID(), boardId, col.name, col.position, col.color, col.wipLimit);
      }

      // Log activity
      db.prepare(
        'INSERT INTO activity_log (id, workspace_id, project_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), workspace_id, projectId, user.id, 'project_created', JSON.stringify({ projectName: name.trim() }), now);
    });

    createProject();

    const project = db.prepare(`
      SELECT p.*, u.name as creator_name
      FROM projects p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ?
    `).get(projectId);

    return NextResponse.json({ project, boardId }, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
