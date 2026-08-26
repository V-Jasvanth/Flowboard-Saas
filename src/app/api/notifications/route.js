import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const notifications = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY read ASC, created_at DESC LIMIT 50').all(user.id);
    return NextResponse.json(notifications);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const body = await request.json();

    if (body.all) {
      await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(user.id);
    } else if (body.id) {
      await db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(body.id, user.id);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
