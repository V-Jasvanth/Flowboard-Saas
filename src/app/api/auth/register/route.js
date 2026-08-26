import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const { getDatabase } = require('@/lib/db');
    const { hashPassword, generateToken } = require('@/lib/auth');
    const db = getDatabase();

    // Check if email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    // Create user
    db.prepare(
      'INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, name, email.toLowerCase(), passwordHash, now);

    // Create a default workspace for the user
    const workspaceId = crypto.randomUUID();
    const baseSlug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-workspace`;
    const existingSlug = db.prepare('SELECT id FROM workspaces WHERE slug = ?').get(baseSlug);
    const slug = existingSlug ? `${baseSlug}-${Date.now()}` : baseSlug;
    db.prepare(
      'INSERT INTO workspaces (id, name, slug, description, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(workspaceId, `${name}'s Workspace`, slug, `Default workspace for ${name}`, userId, now);

    // Add user as owner member
    db.prepare(
      'INSERT INTO members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), workspaceId, userId, 'owner', now);

    // Create a default project
    const projectId = crypto.randomUUID();
    db.prepare(
      'INSERT INTO projects (id, workspace_id, name, description, key, color, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(projectId, workspaceId, 'My First Project', 'Get started with your first project', 'MFP', '#6366f1', userId, now);

    // Create a default board
    const boardId = crypto.randomUUID();
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

    // Generate token
    const token = generateToken({ id: userId, email: email.toLowerCase(), name });

    return NextResponse.json({
      token,
      user: {
        id: userId,
        name,
        email: email.toLowerCase(),
        created_at: now
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
