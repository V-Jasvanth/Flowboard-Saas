import { NextResponse } from 'next/server';

export async function PATCH(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { getDatabase } = require('@/lib/db');
    const bcrypt = require('bcryptjs');
    const db = getDatabase();
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new passwords are required' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    const dbUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const valid = bcrypt.compareSync(currentPassword, dbUser.password_hash);
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('PATCH /api/auth/password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
