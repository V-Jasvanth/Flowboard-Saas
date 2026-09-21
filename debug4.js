const db = require('better-sqlite3')('flowboard.db');
const workspaceId = 'bc9c9c03-dd3c-44b6-a132-cc39b07714f1';

try {
  const members = db.prepare(`
    SELECT m.id, m.workspace_id, m.user_id, m.role, m.joined_at,
      u.name as user_name, u.email as user_email, u.avatar_url as user_avatar
    FROM members m
    INNER JOIN users u ON u.id = m.user_id
    WHERE m.workspace_id = ?
    ORDER BY
      CASE m.role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'member' THEN 3
        ELSE 4
      END,
      m.joined_at ASC
  `).all(workspaceId);
  console.log("Success! Members:", members.length);
} catch (e) {
  console.error("Error executing query:", e);
}
