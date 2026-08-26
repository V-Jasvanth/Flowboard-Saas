import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const projectId = searchParams.get('project_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = 'SELECT a.*, u.name as user_name, u.avatar_url as user_avatar FROM activity_log a LEFT JOIN users u ON a.user_id = u.id WHERE 1=1';
    const params = [];
    if (workspaceId) { query += ' AND a.workspace_id = ?'; params.push(workspaceId); }
    if (projectId) { query += ' AND a.project_id = ?'; params.push(projectId); }
    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const activities = db.prepare(query).all(...params);
    return NextResponse.json(activities);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
