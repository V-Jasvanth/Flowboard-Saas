const { createClient } = require('@libsql/client');
const path = require('path');
const bcrypt = require('bcryptjs');

let db;

function formatArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

function convertRow(row) {
  if (!row) return undefined;
  const obj = {};
  for (const key of Object.keys(row)) {
    obj[key] = row[key];
  }
  return obj;
}

function getDatabase() {
  if (db) return db;

  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  let client;

  if (url && (url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('http://') || url.startsWith('wss://'))) {
    // Remote Turso DB connection
    client = createClient({ url, authToken });
  } else {
    // Local SQLite file connection via @libsql/client
    const localDbPath = `file:${path.join(process.cwd(), 'flowboard.db')}`;
    client = createClient({ url: localDbPath });
  }

  db = {
    client,
    prepare(sql) {
      return {
        async get(...args) {
          const res = await client.execute({ sql, args: formatArgs(args) });
          return res.rows[0] ? convertRow(res.rows[0]) : undefined;
        },
        async all(...args) {
          const res = await client.execute({ sql, args: formatArgs(args) });
          return res.rows.map(convertRow);
        },
        async run(...args) {
          const res = await client.execute({ sql, args: formatArgs(args) });
          return {
            changes: Number(res.rowsAffected),
            lastInsertRowid: res.lastInsertRowid !== undefined ? String(res.lastInsertRowid) : 0
          };
        }
      };
    },
    async exec(sql) {
      await client.executeMultiple(sql);
    },
    transaction(fn) {
      return async (...txArgs) => {
        return await fn(...txArgs);
      };
    },
    pragma() {
      return [];
    }
  };

  initializeDatabase(db);
  seedDatabase(db);

  return db;
}

async function initializeDatabase(database) {
  try {
    await database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        theme TEXT DEFAULT 'system',
        notification_preferences TEXT DEFAULT '{"email":true,"inApp":true}'
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (owner_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(workspace_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        key TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        icon TEXT,
        status TEXT DEFAULT 'active',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS columns (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        color TEXT DEFAULT '#64748b',
        wip_limit INTEGER DEFAULT 0,
        FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'open',
        assignee_id TEXT,
        reporter_id TEXT,
        due_date TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        story_points INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (assignee_id) REFERENCES users(id),
        FOREIGN KEY (reporter_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS labels (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_labels (
        task_id TEXT NOT NULL,
        label_id TEXT NOT NULL,
        PRIMARY KEY (task_id, label_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        project_id TEXT,
        task_id TEXT,
        user_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
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
      );

      CREATE INDEX IF NOT EXISTS idx_members_workspace ON members(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_boards_project ON boards(project_id);
      CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
      CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_log(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_log(project_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    `);
  } catch (e) {
    console.error('Schema initialization notice:', e.message);
  }
}

async function seedDatabase(database) {
  try {
    const userCount = await database.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount && userCount.count > 0) {
      return;
    }
  } catch (e) {
    return;
  }

  const passwordHash = bcrypt.hashSync('demo1234', 10);

  // Seed data
  const demoUserId = crypto.randomUUID();
  const aliceUserId = crypto.randomUUID();
  const bobUserId = crypto.randomUUID();

  const insertUser = database.prepare(
    'INSERT INTO users (id, name, email, password_hash, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  await insertUser.run(demoUserId, 'Demo User', 'demo@flowboard.com', passwordHash, null, '2026-01-15T10:00:00.000Z');
  await insertUser.run(aliceUserId, 'Alice Johnson', 'alice@flowboard.com', passwordHash, null, '2026-01-16T09:00:00.000Z');
  await insertUser.run(bobUserId, 'Bob Smith', 'bob@flowboard.com', passwordHash, null, '2026-01-17T11:00:00.000Z');

  const workspaceId = crypto.randomUUID();
  await database.prepare(
    'INSERT INTO workspaces (id, name, slug, description, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(workspaceId, 'FlowBoard Team', 'flowboard-team', 'Default workspace for the FlowBoard team', demoUserId, '2026-01-15T10:05:00.000Z');

  const insertMember = database.prepare(
    'INSERT INTO members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'
  );
  await insertMember.run(crypto.randomUUID(), workspaceId, demoUserId, 'owner', '2026-01-15T10:05:00.000Z');
  await insertMember.run(crypto.randomUUID(), workspaceId, aliceUserId, 'admin', '2026-01-16T09:05:00.000Z');
  await insertMember.run(crypto.randomUUID(), workspaceId, bobUserId, 'member', '2026-01-17T11:05:00.000Z');

  const projectId = crypto.randomUUID();
  await database.prepare(
    'INSERT INTO projects (id, workspace_id, name, description, key, color, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(projectId, workspaceId, 'Product Launch', 'Track all tasks related to the product launch', 'PL', '#6366f1', demoUserId, '2026-01-15T10:10:00.000Z');

  const boardId = crypto.randomUUID();
  await database.prepare(
    'INSERT INTO boards (id, project_id, name, created_at) VALUES (?, ?, ?, ?)'
  ).run(boardId, projectId, 'Sprint Board', '2026-01-15T10:10:00.000Z');

  const colBacklogId = crypto.randomUUID();
  const colTodoId = crypto.randomUUID();
  const colInProgressId = crypto.randomUUID();
  const colInReviewId = crypto.randomUUID();
  const colDoneId = crypto.randomUUID();

  const insertColumn = database.prepare(
    'INSERT INTO columns (id, board_id, name, position, color, wip_limit) VALUES (?, ?, ?, ?, ?, ?)'
  );
  await insertColumn.run(colBacklogId, boardId, 'Backlog', 0, '#64748b', 0);
  await insertColumn.run(colTodoId, boardId, 'To Do', 1, '#3b82f6', 5);
  await insertColumn.run(colInProgressId, boardId, 'In Progress', 2, '#f59e0b', 3);
  await insertColumn.run(colInReviewId, boardId, 'In Review', 3, '#8b5cf6', 3);
  await insertColumn.run(colDoneId, boardId, 'Done', 4, '#22c55e', 0);
}

module.exports = { getDatabase };
