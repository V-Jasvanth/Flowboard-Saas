try {
  require('./src/app/api/workspaces/[id]/members/route.js');
  console.log('Syntax OK');
} catch (e) {
  console.error('Syntax error:', e);
}
