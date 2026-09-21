const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
      options.headers['Cookie'] = `flowboard-token=${token}`;
    }

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting E2E Tests ---');
  try {
    // 1. Auth: Login with demo user
    let res = await request('POST', '/api/auth/login', { email: 'demo@flowboard.com', password: 'demo1234' });
    if (res.status !== 200) throw new Error('Login failed: ' + JSON.stringify(res.data));
    const token = res.data.token;
    const userId = res.data.user.id;
    console.log('✓ Login successful');

    // 2. Workspaces: Create workspace
    res = await request('POST', '/api/workspaces', { name: 'E2E Test Workspace', description: 'Test' }, token);
    if (res.status !== 200 && res.status !== 201) throw new Error('Create workspace failed');
    const workspaceId = res.data.workspace ? res.data.workspace.id : res.data.id;
    console.log('✓ Create workspace successful');

    // 3. Projects: Create project
    res = await request('POST', '/api/projects', { workspace_id: workspaceId, name: 'E2E Test Project', key: 'E2E', color: '#000000' }, token);
    if (res.status !== 200 && res.status !== 201) throw new Error('Create project failed');
    const projectId = res.data.project ? res.data.project.id : res.data.id;
    console.log('✓ Create project successful');

    // 4. Boards: Get project details
    res = await request('GET', `/api/projects/${projectId}`, null, token);
    const boards = res.data.boards;
    const boardId = boards[0].id;
    res = await request('GET', `/api/boards/${boardId}`, null, token);
    if (res.status !== 200) throw new Error('Get board failed');
    const columns = res.data.columns;
    const colId = columns[0].id;
    console.log('✓ Get board successful');

    // 5. Tasks: Create task
    res = await request('POST', '/api/tasks', { project_id: projectId, column_id: colId, title: 'Test E2E Task', priority: 'high', assignee_id: userId }, token);
    if (res.status !== 200 && res.status !== 201) throw new Error('Create task failed: ' + JSON.stringify(res.data));
    const taskId = res.data.id;
    console.log('✓ Create task successful');

    // 6. Comments: Add comment
    res = await request('POST', `/api/tasks/${taskId}/comments`, { content: 'Testing a comment @alice' }, token);
    if (res.status !== 200 && res.status !== 201) throw new Error('Add comment failed: ' + JSON.stringify(res.data));
    console.log('✓ Add comment successful');

    // 7. Tasks: Reorder task
    const targetColId = columns[1].id;
    res = await request('PATCH', '/api/tasks/reorder', { taskId, targetColumnId: targetColId, newPosition: 0 }, token);
    if (res.status !== 200) throw new Error('Reorder task failed: ' + JSON.stringify(res.data));
    console.log('✓ Reorder task successful');

    // 8. Notifications: Get notifications
    res = await request('GET', '/api/notifications', null, token);
    if (res.status !== 200) throw new Error('Get notifications failed');
    console.log('✓ Get notifications successful');

    // 9. Analytics: Get analytics
    res = await request('GET', `/api/analytics?workspace_id=${workspaceId}`, null, token);
    if (res.status !== 200) throw new Error('Get analytics failed');
    console.log('✓ Get analytics successful');

    console.log('\\nAll tests passed successfully!');
  } catch (err) {
    console.error('Test Failed:', err.message);
  }
}

runTests();
