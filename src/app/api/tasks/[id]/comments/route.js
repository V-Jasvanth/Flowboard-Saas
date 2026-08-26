import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { id } = await params;
    const comments = db.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
      FROM comments c JOIN users u ON c.user_id = u.id WHERE c.task_id = ? ORDER BY c.created_at ASC
    `).all(id);
    return NextResponse.json(comments);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { id } = await params;
    const { content } = await request.json();
    if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 });

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO comments (id, task_id, user_id, content, created_at) VALUES (?,?,?,?,?)').run(commentId, id, user.id, content, now);

    const project = db.prepare('SELECT workspace_id FROM projects WHERE id = ?').get(task.project_id);
    db.prepare('INSERT INTO activity_log (id, workspace_id, project_id, task_id, user_id, action, details, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), project?.workspace_id, task.project_id, id, user.id, 'comment_added', JSON.stringify({ taskTitle: task.title }), now);

    // Extract @mentions from content
    const mentionRegex = /@(\w+)/g;
    const mentions = [...content.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
    
    // Find mentioned users
    const mentionedUsers = [];
    if (mentions.length > 0) {
      const placeholders = mentions.map(() => '?').join(',');
      // We look up by name (lowercased) since that's what the UI displays. Wait, we should probably check against name.
      // E.g., @john will match user with name "John"
      const foundUsers = db.prepare(`SELECT id, name FROM users WHERE LOWER(REPLACE(name, ' ', '')) IN (${placeholders})`).all(...mentions);
      foundUsers.forEach(u => {
        if (u.id !== user.id) mentionedUsers.push(u.id);
      });
    }

    // Default notifications for assignee and reporter
    const defaultNotifyUsers = [task.assignee_id, task.reporter_id].filter(uid => uid && uid !== user.id);
    const uniqueDefaultNotify = [...new Set(defaultNotifyUsers)];
    uniqueDefaultNotify.forEach(uid => {
      // Don't send "New Comment" if we are sending a "Mention" notification to them
      if (!mentionedUsers.includes(uid)) {
        db.prepare('INSERT INTO notifications (id, user_id, workspace_id, type, title, message, read, link, created_at) VALUES (?,?,?,?,?,?,0,?,?)')
          .run(crypto.randomUUID(), uid, project?.workspace_id, 'comment', 'New Comment', `${user.name} commented on "${task.title}"`, `/dashboard/board/${task.project_id}?highlight=${id}`, now);
      }
    });

    // Send Mention notifications
    mentionedUsers.forEach(uid => {
      db.prepare('INSERT INTO notifications (id, user_id, workspace_id, type, title, message, read, link, created_at) VALUES (?,?,?,?,?,?,0,?,?)')
        .run(crypto.randomUUID(), uid, project?.workspace_id, 'mention', 'Mentioned in Comment', `${user.name} mentioned you in a comment on "${task.title}"`, `/dashboard/board/${task.project_id}?highlight=${id}`, now);
    });

    const comment = db.prepare('SELECT c.*, u.name as user_name, u.email as user_email FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(commentId);
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
