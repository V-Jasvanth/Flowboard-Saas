const fs = require('fs');
const path = require('path');

function searchMockData(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchMockData(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('Alice') || content.includes('mock') || content.includes('4 members')) {
        console.log(`Found in ${fullPath}`);
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (line.includes('Alice') || line.includes('mock') || line.includes('4 members') || line.includes('Team Size: 4')) {
            console.log(`  ${i + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchMockData(path.join(__dirname, 'src'));
