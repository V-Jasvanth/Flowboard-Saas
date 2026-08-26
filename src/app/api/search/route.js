import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { getCurrentUser } = require('@/lib/auth');
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { getDatabase } = require('@/lib/db');
    const db = getDatabase();
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q')?.trim();
    const workspaceId = searchParams.get('workspace_id');

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Detect if user is searching by task key (e.g. "PL-3", "MFP-1")
    const keyMatch = query.match(/^([A-Za-z]+)-?(\d+)$/);

    let sql = `
      SELECT t.id, t.title, t.description, t.priority, t.position,
             t.column_id, t.project_id, t.assignee_id,
             c.name as column_name, c.color as column_color,
             p.name as project_name, p.key as project_key,
             u.name as assignee_name,
             b.id as board_id
      FROM tasks t
      LEFT JOIN columns c ON t.column_id = c.id
      LEFT JOIN boards b ON c.board_id = b.id
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE p.workspace_id = ?
    `;
    const params = [workspaceId];

    if (keyMatch) {
      // Search by project key + position number
      const projectKey = keyMatch[1].toUpperCase();
      const position = parseInt(keyMatch[2]) - 1; // 0-indexed internally
      sql += ` AND (
        (UPPER(p.key) = ? AND t.position = ?)
        OR t.title LIKE ?
        OR t.description LIKE ?
        OR u.name LIKE ?
      )`;
      params.push(projectKey, position, `%${query}%`, `%${query}%`, `%${query}%`);
    } else {
      // General text search: title, description, assignee name
      const like = `%${query}%`;
      sql += ` AND (
        t.title LIKE ?
        OR t.description LIKE ?
        OR u.name LIKE ?
      )`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY t.updated_at DESC LIMIT 15';

    const results = db.prepare(sql).all(...params);

    // Format results with computed task key (e.g. "PL-3")
    const formatted = results.map(r => ({
      id: r.id,
      title: r.title,
      taskKey: `${r.project_key}-${r.position + 1}`,
      priority: r.priority,
      columnName: r.column_name,
      columnColor: r.column_color,
      projectName: r.project_name,
      projectId: r.project_id,
      assigneeName: r.assignee_name,
      boardId: r.board_id,
    }));

    return NextResponse.json({ results: formatted });
  } catch (error) {
    console.error('GET /api/search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
