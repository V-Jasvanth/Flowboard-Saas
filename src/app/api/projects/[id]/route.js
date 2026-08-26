import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const { getDatabase } = require('@/lib/db');

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const db = getDatabase();

    const project = await db.prepare(`
      SELECT p.*, u.name as creator_name,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM boards WHERE project_id = p.id) as board_count
      FROM projects p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ?
    `).get(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify workspace membership
    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(project.workspace_id, user.id);

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get boards for this project
    const boards = await db.prepare('SELECT * FROM boards WHERE project_id = ? ORDER BY created_at ASC').all(id);

    // Get labels for this project
    const labels = await db.prepare('SELECT * FROM labels WHERE project_id = ?').all(id);

    return NextResponse.json({ project, boards, labels });
  } catch (error) {
    console.error('Get project error:', error);
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

    const { id } = await params;
    const db = getDatabase();

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify workspace membership
    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(project.workspace_id, user.id);

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = ['name', 'description', 'key', 'color', 'icon', 'status'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(field === 'key' ? body[field].toUpperCase() : body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    await db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedProject = await db.prepare('SELECT * FROM projects WHERE id = ?').get(id);

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error('Update project error:', error);
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

    const { id } = await params;
    const db = getDatabase();

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify workspace owner/admin
    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(project.workspace_id, user.id);

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can delete projects' }, { status: 403 });
    }

    // Delete project (cascades to boards, columns, tasks, labels, etc.)
    await db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    // Log activity
    await db.prepare(
      'INSERT INTO activity_log (id, workspace_id, project_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), project.workspace_id, null, user.id, 'project_deleted', JSON.stringify({ projectName: project.name }), new Date().toISOString());

    return NextResponse.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
