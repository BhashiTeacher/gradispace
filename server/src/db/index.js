const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.NODE_ENV === 'development') {
    console.log(`[db] ${Date.now() - start}ms — ${text.slice(0, 80)}`);
  }
  return res;
}

async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
