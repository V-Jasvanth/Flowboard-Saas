const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(process.cwd(), 'flowboard.db');

let db;

function getDatabase() {
  if (!db) {
    try {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      initializeDatabase(db);
      seedDatabase(db);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }
  return db;
}

function initializeDatabase(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  // Migrations for existing databases
  const tableInfo = database.pragma('table_info(users)');
  const hasTheme = tableInfo.some(col => col.name === 'theme');
  const hasNotifPrefs = tableInfo.some(col => col.name === 'notification_preferences');

  if (!hasTheme) {
    database.exec("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'system'");
  }
  if (!hasNotifPrefs) {
    database.exec("ALTER TABLE users ADD COLUMN notification_preferences TEXT DEFAULT '{\"email\":true,\"inApp\":true}'");
  }
}

function seedDatabase(database) {
  // Check if data already exists
  const userCount = database.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) {
    return;
  }

  const passwordHash = bcrypt.hashSync('demo1234', 10);

  // --- Users ---
  const demoUserId = crypto.randomUUID();
  const aliceUserId = crypto.randomUUID();
  const bobUserId = crypto.randomUUID();

  const insertUser = database.prepare(
    'INSERT INTO users (id, name, email, password_hash, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const seedTransaction = database.transaction(() => {
    insertUser.run(demoUserId, 'Demo User', 'demo@flowboard.com', passwordHash, null, '2026-01-15T10:00:00.000Z');
    insertUser.run(aliceUserId, 'Alice Johnson', 'alice@flowboard.com', passwordHash, null, '2026-01-16T09:00:00.000Z');
    insertUser.run(bobUserId, 'Bob Smith', 'bob@flowboard.com', passwordHash, null, '2026-01-17T11:00:00.000Z');

    // --- Workspace ---
    const workspaceId = crypto.randomUUID();
    database.prepare(
      'INSERT INTO workspaces (id, name, slug, description, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(workspaceId, 'FlowBoard Team', 'flowboard-team', 'Default workspace for the FlowBoard team', demoUserId, '2026-01-15T10:05:00.000Z');

    // --- Members ---
    const insertMember = database.prepare(
      'INSERT INTO members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)'
    );
    insertMember.run(crypto.randomUUID(), workspaceId, demoUserId, 'owner', '2026-01-15T10:05:00.000Z');
    insertMember.run(crypto.randomUUID(), workspaceId, aliceUserId, 'admin', '2026-01-16T09:05:00.000Z');
    insertMember.run(crypto.randomUUID(), workspaceId, bobUserId, 'member', '2026-01-17T11:05:00.000Z');

    // --- Project ---
    const projectId = crypto.randomUUID();
    database.prepare(
      'INSERT INTO projects (id, workspace_id, name, description, key, color, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(projectId, workspaceId, 'Product Launch', 'Track all tasks related to the product launch', 'PL', '#6366f1', demoUserId, '2026-01-15T10:10:00.000Z');

    // --- Board ---
    const boardId = crypto.randomUUID();
    database.prepare(
      'INSERT INTO boards (id, project_id, name, created_at) VALUES (?, ?, ?, ?)'
    ).run(boardId, projectId, 'Sprint Board', '2026-01-15T10:10:00.000Z');

    // --- Columns ---
    const colBacklogId = crypto.randomUUID();
    const colTodoId = crypto.randomUUID();
    const colInProgressId = crypto.randomUUID();
    const colInReviewId = crypto.randomUUID();
    const colDoneId = crypto.randomUUID();

    const insertColumn = database.prepare(
      'INSERT INTO columns (id, board_id, name, position, color, wip_limit) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insertColumn.run(colBacklogId, boardId, 'Backlog', 0, '#64748b', 0);
    insertColumn.run(colTodoId, boardId, 'To Do', 1, '#3b82f6', 5);
    insertColumn.run(colInProgressId, boardId, 'In Progress', 2, '#f59e0b', 3);
    insertColumn.run(colInReviewId, boardId, 'In Review', 3, '#8b5cf6', 3);
    insertColumn.run(colDoneId, boardId, 'Done', 4, '#22c55e', 0);

    // --- Labels ---
    const labelBugId = crypto.randomUUID();
    const labelFeatureId = crypto.randomUUID();
    const labelImprovementId = crypto.randomUUID();
    const labelDocsId = crypto.randomUUID();

    const insertLabel = database.prepare(
      'INSERT INTO labels (id, project_id, name, color) VALUES (?, ?, ?, ?)'
    );
    insertLabel.run(labelBugId, projectId, 'Bug', '#ef4444');
    insertLabel.run(labelFeatureId, projectId, 'Feature', '#3b82f6');
    insertLabel.run(labelImprovementId, projectId, 'Improvement', '#f59e0b');
    insertLabel.run(labelDocsId, projectId, 'Documentation', '#22c55e');

    // --- Tasks (15 tasks spread across columns) ---
    const insertTask = database.prepare(
      'INSERT INTO tasks (id, column_id, project_id, title, description, priority, status, assignee_id, reporter_id, due_date, position, story_points, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertTaskLabel = database.prepare(
      'INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)'
    );

    // Backlog tasks (3)
    const task1 = crypto.randomUUID();
    insertTask.run(task1, colBacklogId, projectId, 'Research competitor pricing models', 'Analyze pricing strategies of top 5 competitors and prepare a report.', 'low', 'open', aliceUserId, demoUserId, '2026-03-15', 0, 3, '2026-02-01T09:00:00.000Z', '2026-02-01T09:00:00.000Z');
    insertTaskLabel.run(task1, labelFeatureId);

    const task2 = crypto.randomUUID();
    insertTask.run(task2, colBacklogId, projectId, 'Design email notification templates', 'Create responsive email templates for all notification types.', 'medium', 'open', bobUserId, demoUserId, '2026-03-20', 1, 5, '2026-02-01T10:00:00.000Z', '2026-02-01T10:00:00.000Z');
    insertTaskLabel.run(task2, labelFeatureId);

    const task3 = crypto.randomUUID();
    insertTask.run(task3, colBacklogId, projectId, 'Set up analytics tracking', 'Integrate Google Analytics and custom event tracking across all pages.', 'low', 'open', null, aliceUserId, '2026-04-01', 2, 2, '2026-02-02T08:00:00.000Z', '2026-02-02T08:00:00.000Z');
    insertTaskLabel.run(task3, labelImprovementId);

    // To Do tasks (4)
    const task4 = crypto.randomUUID();
    insertTask.run(task4, colTodoId, projectId, 'Implement user onboarding flow', 'Create a step-by-step onboarding wizard for new users including workspace setup and team invite.', 'high', 'open', aliceUserId, demoUserId, '2026-02-28', 0, 8, '2026-02-03T09:00:00.000Z', '2026-02-03T09:00:00.000Z');
    insertTaskLabel.run(task4, labelFeatureId);

    const task5 = crypto.randomUUID();
    insertTask.run(task5, colTodoId, projectId, 'Fix login page responsive layout', 'The login form overflows on mobile devices below 375px width.', 'high', 'open', bobUserId, aliceUserId, '2026-02-20', 1, 2, '2026-02-03T10:00:00.000Z', '2026-02-03T10:00:00.000Z');
    insertTaskLabel.run(task5, labelBugId);

    const task6 = crypto.randomUUID();
    insertTask.run(task6, colTodoId, projectId, 'Write API documentation', 'Document all REST API endpoints with examples using OpenAPI/Swagger format.', 'medium', 'open', demoUserId, demoUserId, '2026-03-01', 2, 5, '2026-02-04T08:00:00.000Z', '2026-02-04T08:00:00.000Z');
    insertTaskLabel.run(task6, labelDocsId);

    const task7 = crypto.randomUUID();
    insertTask.run(task7, colTodoId, projectId, 'Add dark mode support', 'Implement dark mode toggle with system preference detection and persistent user choice.', 'low', 'open', aliceUserId, bobUserId, '2026-03-10', 3, 5, '2026-02-04T11:00:00.000Z', '2026-02-04T11:00:00.000Z');
    insertTaskLabel.run(task7, labelImprovementId);

    // In Progress tasks (3)
    const task8 = crypto.randomUUID();
    insertTask.run(task8, colInProgressId, projectId, 'Build dashboard analytics charts', 'Create interactive charts for task distribution, velocity, and burndown using Chart.js.', 'high', 'in_progress', demoUserId, demoUserId, '2026-02-18', 0, 8, '2026-02-05T09:00:00.000Z', '2026-02-10T14:00:00.000Z');
    insertTaskLabel.run(task8, labelFeatureId);

    const task9 = crypto.randomUUID();
    insertTask.run(task9, colInProgressId, projectId, 'Implement drag-and-drop for task board', 'Add drag-and-drop functionality to move tasks between columns with smooth animations.', 'high', 'in_progress', aliceUserId, demoUserId, '2026-02-22', 1, 8, '2026-02-05T10:00:00.000Z', '2026-02-11T10:00:00.000Z');
    insertTaskLabel.run(task9, labelFeatureId);

    const task10 = crypto.randomUUID();
    insertTask.run(task10, colInProgressId, projectId, 'Fix database connection pooling issue', 'Connections are not being properly released causing intermittent 500 errors under load.', 'critical', 'in_progress', bobUserId, aliceUserId, '2026-02-15', 2, 3, '2026-02-06T08:00:00.000Z', '2026-02-12T09:00:00.000Z');
    insertTaskLabel.run(task10, labelBugId);

    // In Review tasks (2)
    const task11 = crypto.randomUUID();
    insertTask.run(task11, colInReviewId, projectId, 'Add workspace settings page', 'Create settings page with workspace name, description, member management, and danger zone.', 'medium', 'in_review', demoUserId, demoUserId, '2026-02-16', 0, 5, '2026-02-01T09:00:00.000Z', '2026-02-13T16:00:00.000Z');
    insertTaskLabel.run(task11, labelFeatureId);

    const task12 = crypto.randomUUID();
    insertTask.run(task12, colInReviewId, projectId, 'Optimize image loading performance', 'Implement lazy loading, WebP conversion, and responsive srcset for all images.', 'medium', 'in_review', aliceUserId, bobUserId, '2026-02-17', 1, 3, '2026-02-02T10:00:00.000Z', '2026-02-13T11:00:00.000Z');
    insertTaskLabel.run(task12, labelImprovementId);

    // Done tasks (3)
    const task13 = crypto.randomUUID();
    insertTask.run(task13, colDoneId, projectId, 'Set up CI/CD pipeline', 'Configure GitHub Actions for automated testing, linting, and deployment to Vercel.', 'high', 'done', bobUserId, demoUserId, '2026-02-10', 0, 5, '2026-01-20T09:00:00.000Z', '2026-02-08T17:00:00.000Z');
    insertTaskLabel.run(task13, labelImprovementId);

    const task14 = crypto.randomUUID();
    insertTask.run(task14, colDoneId, projectId, 'Create user authentication system', 'Implement JWT-based auth with login, register, password hashing, and middleware protection.', 'critical', 'done', demoUserId, demoUserId, '2026-02-05', 1, 13, '2026-01-18T08:00:00.000Z', '2026-02-04T15:00:00.000Z');
    insertTaskLabel.run(task14, labelFeatureId);

    const task15 = crypto.randomUUID();
    insertTask.run(task15, colDoneId, projectId, 'Design and implement landing page', 'Create a responsive landing page with hero section, features, pricing, and CTA.', 'high', 'done', aliceUserId, demoUserId, '2026-02-01', 2, 8, '2026-01-16T09:00:00.000Z', '2026-01-31T12:00:00.000Z');
    insertTaskLabel.run(task15, labelFeatureId);

    // --- Comments (8 comments on various tasks) ---
    const insertComment = database.prepare(
      'INSERT INTO comments (id, task_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)'
    );

    insertComment.run(crypto.randomUUID(), task8, aliceUserId, 'I suggest using Recharts instead of Chart.js — it integrates better with React.', '2026-02-10T15:00:00.000Z');
    insertComment.run(crypto.randomUUID(), task8, demoUserId, 'Good point, Alice. Let me evaluate both and share a comparison.', '2026-02-10T15:30:00.000Z');
    insertComment.run(crypto.randomUUID(), task9, demoUserId, 'Make sure the drag-and-drop works on touch devices too.', '2026-02-11T11:00:00.000Z');
    insertComment.run(crypto.randomUUID(), task9, bobUserId, 'We should use @dnd-kit — it has great touch support out of the box.', '2026-02-11T11:30:00.000Z');
    insertComment.run(crypto.randomUUID(), task10, aliceUserId, 'I found the root cause — the connection pool max size is set to 5, which is too low for production.', '2026-02-12T10:00:00.000Z');
    insertComment.run(crypto.randomUUID(), task14, aliceUserId, 'The JWT middleware is working great. Tested with all edge cases.', '2026-02-04T16:00:00.000Z');
    insertComment.run(crypto.randomUUID(), task11, bobUserId, 'The danger zone section looks good. Should we add a confirmation modal for workspace deletion?', '2026-02-13T17:00:00.000Z');
    insertComment.run(crypto.randomUUID(), task5, aliceUserId, 'I can reproduce this on iPhone SE. The form container needs max-width constraints.', '2026-02-03T14:00:00.000Z');

    // --- Activity Log (12 entries) ---
    const insertActivity = database.prepare(
      'INSERT INTO activity_log (id, workspace_id, project_id, task_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    insertActivity.run(crypto.randomUUID(), workspaceId, projectId, null, demoUserId, 'project_created', JSON.stringify({ projectName: 'Product Launch' }), '2026-01-15T10:10:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, projectId, task14, demoUserId, 'task_created', JSON.stringify({ taskTitle: 'Create user authentication system' }), '2026-01-18T08:00:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, projectId, task15, demoUserId, 'task_created', JSON.stringify({ taskTitle: 'Design and implement landing page' }), '2026-01-16T09:00:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, projectId, task14, demoUserId, 'task_moved', JSON.stringify({ from: 'In Progress', to: 'Done' }), '2026-02-04T15:00:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, projectId, task15, aliceUserId, 'task_completed', JSON.stringify({ taskTitle: 'Design and implement landing page' }), '2026-01-31T12:00:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, projectId, task13, bobUserId, 'task_completed', JSON.stringify({ taskTitle: 'Set up CI/CD pipeline' }), '2026-02-08T17:00:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, projectId, task8, demoUserId, 'task_moved', JSON.stringify({ from: 'To Do', to: 'In Progress' }), '2026-02-10T14:00:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, projectId, task9, aliceUserId, 'task_moved', JSON.stringify({ from: 'To Do', to: 'In Progress' }), '2026-02-11T10:00:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, projectId, task11, demoUserId, 'task_moved', JSON.stringify({ from: 'In Progress', to: 'In Review' }), '2026-02-13T16:00:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, projectId, task10, bobUserId, 'comment_added', JSON.stringify({ taskTitle: 'Fix database connection pooling issue' }), '2026-02-12T10:00:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, null, null, aliceUserId, 'member_joined', JSON.stringify({ memberName: 'Alice Johnson' }), '2026-01-16T09:05:00.000Z');
    insertActivity.run(crypto.randomUUID(), workspaceId, null, null, bobUserId, 'member_joined', JSON.stringify({ memberName: 'Bob Smith' }), '2026-01-17T11:05:00.000Z');

    // --- Notifications (7 for demo user) ---
    const insertNotification = database.prepare(
      'INSERT INTO notifications (id, user_id, workspace_id, type, title, message, read, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    insertNotification.run(crypto.randomUUID(), demoUserId, workspaceId, 'task_assigned', 'Task Assigned', 'You have been assigned to "Build dashboard analytics charts"', 0, `/dashboard/${workspaceId}/tasks/${task8}`, '2026-02-05T09:00:00.000Z');
    insertNotification.run(crypto.randomUUID(), demoUserId, workspaceId, 'comment', 'New Comment', 'Alice commented on "Build dashboard analytics charts"', 0, `/dashboard/${workspaceId}/tasks/${task8}`, '2026-02-10T15:00:00.000Z');
    insertNotification.run(crypto.randomUUID(), demoUserId, workspaceId, 'task_completed', 'Task Completed', '"Design and implement landing page" has been completed', 1, `/dashboard/${workspaceId}/tasks/${task15}`, '2026-01-31T12:00:00.000Z');
    insertNotification.run(crypto.randomUUID(), demoUserId, workspaceId, 'member_joined', 'New Member', 'Alice Johnson joined the workspace', 1, `/dashboard/${workspaceId}/settings`, '2026-01-16T09:05:00.000Z');
    insertNotification.run(crypto.randomUUID(), demoUserId, workspaceId, 'member_joined', 'New Member', 'Bob Smith joined the workspace', 1, `/dashboard/${workspaceId}/settings`, '2026-01-17T11:05:00.000Z');
    insertNotification.run(crypto.randomUUID(), demoUserId, workspaceId, 'comment', 'New Comment', 'Bob commented on "Add workspace settings page"', 0, `/dashboard/${workspaceId}/tasks/${task11}`, '2026-02-13T17:00:00.000Z');
    insertNotification.run(crypto.randomUUID(), demoUserId, workspaceId, 'task_assigned', 'Task Assigned', 'You have been assigned to "Write API documentation"', 0, `/dashboard/${workspaceId}/tasks/${task6}`, '2026-02-04T08:00:00.000Z');
  });

  seedTransaction();
}

module.exports = { getDatabase };
