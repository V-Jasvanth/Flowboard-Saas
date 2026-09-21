const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/workspaces/bc9c9c03-dd3c-44b6-a132-cc39b07714f1/members',
  method: 'GET',
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
});

req.on('error', e => console.error(e));
req.end();
