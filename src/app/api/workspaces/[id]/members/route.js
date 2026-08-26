import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const { getDatabase } = require('@/lib/db');

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const workspaceId = resolvedParams.id;
    const db = getDatabase();

    // Check membership
    let membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspaceId, user.id);

    if (!membership) {
      const workspace = await db.prepare('SELECT owner_id FROM workspaces WHERE id = ?').get(workspaceId);
      if (workspace && workspace.owner_id === user.id) {
        membership = { role: 'owner' };
        try {
          await db.prepare(
            'INSERT INTO members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'
          ).run(crypto.randomUUID(), workspaceId, user.id, 'owner', new Date().toISOString());
        } catch (e) {}
      }
    }

    if (!membership) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 404 });
    }

    const members = await db.prepare(`
      SELECT m.id, m.workspace_id, m.user_id, m.role, m.joined_at,
        u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
      FROM members m
      INNER JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = ?
      ORDER BY
        CASE m.role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'member' THEN 3
          ELSE 4
        END,
        m.joined_at ASC
    `).all(workspaceId);

    return NextResponse.json({ members });
  } catch (error) {
    console.error('List members error:', error);
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

    const resolvedParams = await params;
    const workspaceId = resolvedParams.id;
    const db = getDatabase();

    // Check that current user is owner or admin
    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspaceId, user.id);

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can add members' }, { status: 403 });
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Find user by email
    const targetUser = await db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email.toLowerCase());
    if (!targetUser) {
      return NextResponse.json({ error: 'No user found with that email' }, { status: 404 });
    }

    // Check if already a member
    const existingMember = await db.prepare(
      'SELECT id FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspaceId, targetUser.id);

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 409 });
    }

    const memberId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.prepare(
      'INSERT INTO members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'
    ).run(memberId, workspaceId, targetUser.id, 'member', now);

    // Create notification for added user
    await db.prepare(
      'INSERT INTO notifications (id, user_id, workspace_id, type, title, message, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(), targetUser.id, workspaceId, 'member_added',
      'Added to Workspace',
      `You have been added to a workspace by ${user.name}`,
      `/dashboard/${workspaceId}`,
      now
    );

    const member = await db.prepare(`
      SELECT m.id, m.workspace_id, m.user_id, m.role, m.joined_at,
        u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
      FROM members m
      INNER JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(memberId);

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error('Add member error:', error);
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

    const { id: workspaceId } = await params;
    const db = getDatabase();

    // Check that current user is owner or admin
    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspaceId, user.id);

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can update member roles' }, { status: 403 });
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId and role are required' }, { status: 400 });
    }

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Role must be "admin" or "member"' }, { status: 400 });
    }

    // Can't change owner role
    const targetMember = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspaceId, userId);

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change the owner\'s role' }, { status: 403 });
    }

    await db.prepare(
      'UPDATE members SET role = ? WHERE workspace_id = ? AND user_id = ?'
    ).run(role, workspaceId, userId);

    return NextResponse.json({ message: 'Member role updated', userId, role });
  } catch (error) {
    console.error('Update member role error:', error);
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

    const { id: workspaceId } = await params;
    const db = getDatabase();

    // Check that current user is owner or admin
    const membership = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspaceId, user.id);

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can remove members' }, { status: 403 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Can't remove owner
    const targetMember = await db.prepare(
      'SELECT role FROM members WHERE workspace_id = ? AND user_id = ?'
    ).get(workspaceId, userId);

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the workspace owner' }, { status: 403 });
    }

    await db.prepare(
      'DELETE FROM members WHERE workspace_id = ? AND user_id = ?'
    ).run(workspaceId, userId);

    return NextResponse.json({ message: 'Member removed', userId });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
