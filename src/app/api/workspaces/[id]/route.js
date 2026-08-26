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

    // Check membership
    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(id, user.id);

    if (!membership) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 });
    }

    const workspace = await db.prepare(`
      SELECT w.*,
        (SELECT COUNT(*) FROM members WHERE workspace_id = w.id) as member_count,
        (SELECT COUNT(*) FROM projects WHERE workspace_id = w.id) as project_count
      FROM workspaces w WHERE w.id = ?
    `).get(id);

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json({ workspace: { ...workspace, user_role: membership.role } });
  } catch (error) {
    console.error('Get workspace error:', error);
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

    // Check ownership/admin
    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(id, user.id);

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can update workspace settings' }, { status: 403 });
    }

    const { name, description } = await request.json();
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    await db.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const workspace = await db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Update workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const { getDatabase } = require('@/lib/db');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const db = getDatabase();
    const membership = await db.prepare('SELECT role FROM members WHERE workspace_id = ? AND user_id = ?').get(id, user.id);
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only the owner can delete the workspace' }, { status: 403 });
    }
    await db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
