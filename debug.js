const db = require('better-sqlite3')('flowboard.db');

const workspaces = db.prepare('SELECT * FROM workspaces').all();
console.log('Workspaces:', workspaces);

if (workspaces.length > 0) {
  const wsId = workspaces[0].id;
  const members = db.prepare('SELECT * FROM members WHERE workspace_id = ?').all(wsId);
  console.log(`Members for ${wsId}:`, members.length);
  
  const analyticsTeamSize = db.prepare('SELECT COUNT(*) as count FROM members WHERE workspace_id = ?').get(wsId)?.count || 0;
  console.log('Analytics Team Size:', analyticsTeamSize);

  const tasksByAssignee = db.prepare(`
    SELECT u.name, COUNT(t.id) as count FROM tasks t
    JOIN users u ON t.assignee_id = u.id
    JOIN projects p ON t.project_id = p.id WHERE p.workspace_id = ? GROUP BY t.assignee_id
  `).all(wsId);
  console.log('Tasks By Assignee:', tasksByAssignee);
}
