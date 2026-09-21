const db = require('better-sqlite3')('flowboard.db');

const workspaces = db.prepare('SELECT * FROM workspaces').all();
workspaces.forEach(ws => {
  const members = db.prepare('SELECT * FROM members WHERE workspace_id = ?').all(ws.id);
  console.log(`Workspace: ${ws.name} (${ws.id})`);
  console.log(`  Members: ${members.length}`);
});
