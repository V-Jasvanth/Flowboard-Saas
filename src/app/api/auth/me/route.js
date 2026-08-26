import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { name, theme, notification_preferences } = await request.json();

    const updates = [];
    const values = [];

    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (theme !== undefined) {
      updates.push('theme = ?');
      values.push(theme);
    }

    if (notification_preferences !== undefined) {
      updates.push('notification_preferences = ?');
      values.push(typeof notification_preferences === 'string' ? notification_preferences : JSON.stringify(notification_preferences));
    }

    if (updates.length > 0) {
      values.push(user.id);
      await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = await db.prepare('SELECT id, name, email, avatar_url, theme, notification_preferences, created_at FROM users WHERE id = ?').get(user.id);
    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('PATCH /api/auth/me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
