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
    const workspaces = db.prepare(`
      SELECT w.*, m.role as user_role,
        (SELECT COUNT(*) FROM members WHERE workspace_id = w.id) as member_count,
        (SELECT COUNT(*) FROM projects WHERE workspace_id = w.id) as project_count
      FROM workspaces w
      INNER JOIN members m ON m.workspace_id = w.id AND m.user_id = ?
      ORDER BY w.created_at DESC
    `).all(user.id);

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('List workspaces error:', error);
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

    const { name, description } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    const db = getDatabase();
    const workspaceId = crypto.randomUUID();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const now = new Date().toISOString();

    // Check for slug uniqueness
    const existingSlug = db.prepare('SELECT id FROM workspaces WHERE slug = ?').get(slug);
    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    db.prepare(
      'INSERT INTO workspaces (id, name, slug, description, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(workspaceId, name.trim(), finalSlug, description || null, user.id, now);

    // Add creator as owner
    db.prepare(
      'INSERT INTO members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), workspaceId, user.id, 'owner', now);

    const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    console.error('Create workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
