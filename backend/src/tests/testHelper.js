import { runMigrations } from '../db/migrate.js';
import { getPool, closePool } from '../db/pool.js';
import { config } from '../config/index.js';

// Switch database to isolated test DB
config.db.database = 'kiaan_ai_test';

export async function initTestDatabase() {
  const pool = getPool();
  await runMigrations(pool);
  return pool;
}

export async function clearTestDatabase() {
  const pool = getPool();
  await pool.query('DELETE FROM feedback');
  await pool.query('DELETE FROM attachments');
  await pool.query('DELETE FROM messages');
  await pool.query('DELETE FROM search_history');
  await pool.query('DELETE FROM user_memories');
  await pool.query('DELETE FROM conversations');
}

export async function closeTestDatabase() {
  await closePool();
}
