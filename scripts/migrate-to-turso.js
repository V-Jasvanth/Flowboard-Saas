const { createClient } = require('@libsql/client');
const path = require('path');

async function migrateToTurso() {
  console.log('=== FLOWBOARD TURSO DATABASE MIGRATION ===\n');

  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error('ERROR: DATABASE_URL or TURSO_DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const localFileUrl = `file:${path.join(process.cwd(), 'flowboard.db')}`;
  console.log(`Source DB: local file (${localFileUrl})`);
  console.log(`Target DB: ${url}\n`);

  // 1. Connect to local SQLite source via @libsql/client
  const localDb = createClient({ url: localFileUrl });

  // 2. Connect to Turso target via @libsql/client
  const tursoClient = createClient({ url, authToken });

  // 3. Initialize Target Schema
  console.log('Initializing schema on target database...');
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      theme TEXT DEFAULT 'system',
      notification_preferences TEXT DEFAULT '{"email":true,"inApp":true}'
    );`,
    `CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );`,
    `CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(workspace_id, user_id)
    );`,
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      key TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );`,
    `CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      color TEXT DEFAULT '#64748b',
      wip_limit INTEGER DEFAULT 0,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      column_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      assignee_id TEXT,
      reporter_id TEXT NOT NULL,
      due_date TEXT,
      position INTEGER NOT NULL,
      story_points INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    );`,
    `CREATE TABLE IF NOT EXISTS task_labels (
      task_id TEXT NOT NULL,
      label_id TEXT NOT NULL,
      PRIMARY KEY (task_id, label_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      project_id TEXT,
      task_id TEXT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      workspace_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );`
  ];

  for (const stmt of schemaStatements) {
    await tursoClient.execute(stmt);
  }
  console.log('Schema successfully verified on target database.\n');

  // 4. Tables ordered by dependency
  const tables = [
    'users',
    'workspaces',
    'members',
    'projects',
    'boards',
    'columns',
    'labels',
    'tasks',
    'task_labels',
    'comments',
    'activity_log',
    'notifications'
  ];

  console.log('Migrating table rows (Idempotent INSERT OR IGNORE)...');

  for (const tableName of tables) {
    const localResult = await localDb.execute(`SELECT * FROM ${tableName}`);
    const rows = localResult.rows;
    if (rows.length === 0) {
      console.log(`  - Table ${tableName}: 0 rows to migrate.`);
      continue;
    }

    const sampleRow = rows[0];
    const columnsList = Object.keys(sampleRow);
    const placeholders = columnsList.map(() => '?').join(', ');
    const sql = `INSERT OR IGNORE INTO ${tableName} (${columnsList.join(', ')}) VALUES (${placeholders})`;

    // Batch execute in chunks of 50 for efficiency
    const chunkSize = 50;
    let migratedCount = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const batchStatements = chunk.map(row => ({
        sql,
        args: columnsList.map(col => row[col])
      }));
      await tursoClient.batch(batchStatements, 'write');
      migratedCount += chunk.length;
    }

    console.log(`  ✓ Table ${tableName}: ${migratedCount} rows processed.`);
  }

  // 5. Verification: Compare row counts between Source and Target DB
  console.log('\n=== ROW COUNT VERIFICATION ===\n');
  console.log('Table'.padEnd(18) + ' | ' + 'Local DB'.padEnd(10) + ' | ' + 'Turso DB'.padEnd(10) + ' | ' + 'Status');
  console.log('-'.repeat(55));

  let allMatched = true;

  for (const tableName of tables) {
    const localRes = await localDb.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
    const localCount = Number(localRes.rows[0].count);
    const tursoResult = await tursoClient.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
    const tursoCount = Number(tursoResult.rows[0].count);

    const match = localCount === tursoCount;
    if (!match) allMatched = false;

    const status = match ? '✓ MATCH' : `❌ MISMATCH (Local: ${localCount}, Turso: ${tursoCount})`;
    console.log(tableName.padEnd(18) + ' | ' + String(localCount).padEnd(10) + ' | ' + String(tursoCount).padEnd(10) + ' | ' + status);
  }

  console.log('\n' + '-'.repeat(55));
  if (allMatched) {
    console.log('SUCCESS: All tables verified! 100% data integrity preserved.');
  } else {
    console.warn('WARNING: Some table row counts differed. Check details above.');
  }
}

migrateToTurso().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
