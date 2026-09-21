const fs = require('fs');
const path = require('path');

const dirs = [
  'src/app/api/auth/verify-otp',
  'src/app/api/auth/resend-otp',
  'src/app/verify-email'
];

const files = [
  'src/lib/email.js',
  'test_smtp.js'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log('Deleted directory:', fullPath);
  }
});

files.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log('Deleted file:', fullPath);
  }
});
