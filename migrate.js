const db = require('better-sqlite3')('C:/Users/USER/.gemini/antigravity/scratch/flowboard/flowboard.db');
try { db.exec("ALTER TABLE projects ADD COLUMN icon TEXT;"); console.log('Added icon'); } catch(e) { console.error(e.message); }
try { db.exec("ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active';"); console.log('Added status'); } catch(e) { console.error(e.message); }
console.log('Done');
