require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs   = require('fs');
const path = require('path');
const db   = require('./index');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Running migrations…');
  await db.query(sql);
  console.log('Migrations complete.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
