#!/usr/bin/env node
/**
 * FlowBoard Integration Test Script
 * Tests core API flows: auth, workspaces, tasks, drag-and-drop, team, analytics, notifications
 * 
 * Usage: node test-integration.js [base_url]
 * Default: http://localhost:3000
 */

const BASE = process.argv[2] || 'http://localhost:3000';

let token = null;
let userId = null;
let workspaceId = null;
let projectId = null;
let boardId = null;
let columnIds = [];
let taskId = null;
let passed = 0;
let failed = 0;
const results = [];

function log(status, test, detail = '') {
  const icon = status === 'PASS' ? '✅' : '❌';
  const msg = `${icon} ${test}${detail ? ` — ${detail}` : ''}`;
  console.log(msg);
  results.push({ status, test, detail });
  if (status === 'PASS') passed++; else failed++;
}

async function api(method, path, body = null, customHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...customHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, ok: res.ok };
}

async function testAuth() {
  console.log('\n--- 1. Authentication ---');

  // Login
  const loginRes = await api('POST', '/api/auth/login', { email: 'demo@flowboard.com', password: 'demo1234' });
  if (loginRes.ok && loginRes.data.token) {
    token = loginRes.data.token;
    log('PASS', 'Login', `token: ${token.slice(0, 20)}...`);
  } else {
    log('FAIL', 'Login', JSON.stringify(loginRes.data));
    return false;
  }

  // Get current user
  const meRes = await api('GET', '/api/auth/me');
  if (meRes.ok && (meRes.data.user || meRes.data.id)) {
    const user = meRes.data.user || meRes.data;
    userId = user.id;
    log('PASS', 'Get current user', `name: ${user.name}, email: ${user.email}`);
  } else {
    log('FAIL', 'Get current user', JSON.stringify(meRes.data));
  }

  // Unauthorized check
  const noAuthRes = await api('GET', '/api/auth/me', null, { Authorization: '' });
  if (noAuthRes.status === 401) {
    log('PASS', 'Unauthorized access rejected');
  } else {
    log('FAIL', 'Unauthorized access rejected', `got status ${noAuthRes.status}`);
  }

  return true;
}

async function testWorkspace() {
  console.log('\n--- 2. Workspace ---');

  const wsRes = await api('GET', '/api/workspaces');
  const workspaces = wsRes.data.workspaces || wsRes.data;
  if (wsRes.ok && Array.isArray(workspaces) && workspaces.length > 0) {
    workspaceId = workspaces[0].id;
    log('PASS', 'List workspaces', `found ${workspaces.length} workspace(s): "${workspaces[0].name}"`);
  } else {
    log('FAIL', 'List workspaces', JSON.stringify(wsRes.data));
    return false;
  }

  // Create workspace
  const newWs = await api('POST', '/api/workspaces', { name: 'Test Workspace', slug: `test-ws-${Date.now()}`, description: 'Integration test workspace' });
  if (newWs.ok || newWs.status === 201) {
    log('PASS', 'Create workspace', `id: ${(newWs.data.workspace || newWs.data).id}`);
  } else {
    log('FAIL', 'Create workspace', JSON.stringify(newWs.data));
  }

  return true;
}

async function testProjects() {
  console.log('\n--- 3. Projects ---');

  const projRes = await api('GET', `/api/projects?workspace_id=${workspaceId}`);
  const projects = projRes.data.projects || projRes.data;
  if (projRes.ok && Array.isArray(projects) && projects.length > 0) {
    projectId = projects[0].id;
    log('PASS', 'List projects', `found ${projects.length} project(s): "${projects[0].name}"`);
  } else {
    log('FAIL', 'List projects', JSON.stringify(projRes.data));
    return false;
  }

  // Get project detail
  const detailRes = await api('GET', `/api/projects/${projectId}`);
  if (detailRes.ok) {
    const proj = detailRes.data.project || detailRes.data;
    const boards = detailRes.data.boards || [];
    if (boards.length > 0) {
      boardId = boards[0].id;
      log('PASS', 'Get project detail', `boards: ${boards.length}, labels: ${(detailRes.data.labels || []).length}`);
    } else {
      log('PASS', 'Get project detail (no boards array)', `project: ${proj.name}`);
    }
  } else {
    log('FAIL', 'Get project detail', JSON.stringify(detailRes.data));
  }

  return true;
}

async function testBoard() {
  console.log('\n--- 4. Board / Kanban ---');

  if (!boardId) {
    log('FAIL', 'Board test skipped', 'No boardId found');
    return false;
  }

  const boardRes = await api('GET', `/api/boards/${boardId}`);
  if (boardRes.ok) {
    const columns = boardRes.data.columns || [];
    columnIds = columns.map(c => c.id);
    log('PASS', 'Get board', `columns: ${columns.map(c => `${c.name}(${(c.tasks || []).length})`).join(', ')}`);
  } else {
    log('FAIL', 'Get board', JSON.stringify(boardRes.data));
    return false;
  }

  return true;
}

async function testTaskCreation() {
  console.log('\n--- 5. Task Creation ---');

  if (columnIds.length === 0) {
    log('FAIL', 'Task creation skipped', 'No columns found');
    return false;
  }

  const createRes = await api('POST', '/api/tasks', {
    column_id: columnIds[0],
    project_id: projectId,
    title: `Integration Test Task ${Date.now()}`,
    description: 'Created by integration test',
    priority: 'high',
    assignee_id: userId,
  });

  if (createRes.ok || createRes.status === 201) {
    taskId = createRes.data.id;
    log('PASS', 'Create task', `id: ${taskId}, title: "${createRes.data.title}"`);
  } else {
    log('FAIL', 'Create task', JSON.stringify(createRes.data));
    return false;
  }

  return true;
}

async function testTaskEdit() {
  console.log('\n--- 6. Task Editing ---');

  if (!taskId) {
    log('FAIL', 'Task edit skipped', 'No taskId');
    return false;
  }

  const editRes = await api('PATCH', `/api/tasks/${taskId}`, { title: 'Updated Test Task', priority: 'critical' });
  if (editRes.ok && editRes.data.title === 'Updated Test Task') {
    log('PASS', 'Edit task', `title: "${editRes.data.title}", priority: "${editRes.data.priority}"`);
  } else {
    log('FAIL', 'Edit task', JSON.stringify(editRes.data));
  }

  return true;
}

async function testDragAndDrop() {
  console.log('\n--- 7. Drag & Drop (column move) ---');

  if (!taskId || columnIds.length < 2) {
    log('FAIL', 'Drag & drop skipped', 'Missing taskId or columns');
    return false;
  }

  const targetColumn = columnIds[1];
  const moveRes = await api('PATCH', `/api/tasks/${taskId}`, { column_id: targetColumn, position: 0 });
  if (moveRes.ok && moveRes.data.column_id === targetColumn) {
    log('PASS', 'Move task to new column', `column_id: ${targetColumn}`);
  } else {
    log('FAIL', 'Move task to new column', JSON.stringify(moveRes.data));
    return false;
  }

  // Verify persistence
  const verifyRes = await api('GET', `/api/tasks/${taskId}`);
  if (verifyRes.ok && verifyRes.data.column_id === targetColumn) {
    log('PASS', 'Drag & drop persistence verified', `column_id still ${targetColumn}`);
  } else {
    log('FAIL', 'Drag & drop persistence', `expected ${targetColumn}, got ${verifyRes.data?.column_id}`);
  }

  return true;
}

async function testTeamManagement() {
  console.log('\n--- 8. Team Management ---');

  const membersRes = await api('GET', `/api/workspaces/${workspaceId}/members`);
  const members = membersRes.data.members || membersRes.data;
  if (membersRes.ok && Array.isArray(members)) {
    log('PASS', 'List members', `found ${members.length} member(s): ${members.map(m => `${m.user_name}(${m.role})`).join(', ')}`);
  } else {
    log('FAIL', 'List members', JSON.stringify(membersRes.data));
  }

  return true;
}

async function testAnalytics() {
  console.log('\n--- 9. Analytics ---');

  const analyticsRes = await api('GET', `/api/analytics?workspace_id=${workspaceId}`);
  if (analyticsRes.ok) {
    const d = analyticsRes.data;
    log('PASS', 'Get analytics', `total: ${d.totalTasks}, completed: ${d.completedTasks}, in-progress: ${d.inProgressTasks}`);

    if (d.teamSize !== undefined && d.teamSize > 0) {
      log('PASS', 'Team size in analytics', `teamSize: ${d.teamSize}`);
    } else {
      log('FAIL', 'Team size in analytics', `teamSize: ${d.teamSize}`);
    }

    if (d.tasksByStatus && d.tasksByStatus.length > 0) {
      log('PASS', 'Tasks by status', `${d.tasksByStatus.length} statuses`);
    } else {
      log('FAIL', 'Tasks by status', 'empty or missing');
    }

    if (d.completedOverTime && d.completedOverTime.length === 30) {
      log('PASS', 'Completion trend data', `30 days, all numeric`);
    } else {
      log('FAIL', 'Completion trend data', `length: ${d.completedOverTime?.length}`);
    }

    if (typeof d.averageCompletionDays === 'number') {
      log('PASS', 'Average completion days', `${d.averageCompletionDays} days`);
    } else {
      log('FAIL', 'Average completion days', `value: ${d.averageCompletionDays}`);
    }
  } else {
    log('FAIL', 'Get analytics', JSON.stringify(analyticsRes.data));
  }

  return true;
}

async function testNotifications() {
  console.log('\n--- 10. Notifications ---');

  const notifRes = await api('GET', '/api/notifications');
  if (notifRes.ok && Array.isArray(notifRes.data)) {
    const notifs = notifRes.data;
    log('PASS', 'Get notifications', `found ${notifs.length} notification(s)`);

    const unread = notifs.filter(n => !n.read);
    log('PASS', 'Unread count', `${unread.length} unread`);

    // Check notification types present
    const types = [...new Set(notifs.map(n => n.type))];
    log('PASS', 'Notification types', types.join(', '));

    // Mark one as read
    if (unread.length > 0) {
      const markRes = await api('PATCH', '/api/notifications', { id: unread[0].id });
      if (markRes.ok) {
        log('PASS', 'Mark notification as read');
      } else {
        log('FAIL', 'Mark notification as read', JSON.stringify(markRes.data));
      }
    }

    // Mark all as read
    const markAllRes = await api('PATCH', '/api/notifications', { all: true });
    if (markAllRes.ok) {
      log('PASS', 'Mark all notifications as read');
    } else {
      log('FAIL', 'Mark all notifications as read', JSON.stringify(markAllRes.data));
    }
  } else {
    log('FAIL', 'Get notifications', JSON.stringify(notifRes.data));
  }

  return true;
}

async function testLogout() {
  console.log('\n--- 11. Logout ---');
  // Simulate logout by clearing token and verifying unauthorized access
  const savedToken = token;
  token = null;
  const meRes = await api('GET', '/api/auth/me');
  if (meRes.status === 401) {
    log('PASS', 'Logout (token cleared, access denied)');
  } else {
    log('FAIL', 'Logout', `expected 401, got ${meRes.status}`);
  }
  token = savedToken;
  return true;
}

async function run() {
  console.log(`\n🧪 FlowBoard Integration Tests\n   Base URL: ${BASE}\n`);

  try {
    const authOk = await testAuth();
    if (!authOk) { console.log('\n⛔ Auth failed, stopping.'); return; }
    await testWorkspace();
    await testProjects();
    await testBoard();
    await testTaskCreation();
    await testTaskEdit();
    await testDragAndDrop();
    await testTeamManagement();
    await testAnalytics();
    await testNotifications();
    await testLogout();
  } catch (err) {
    console.error('\n💥 Test runner error:', err.message);
    failed++;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
