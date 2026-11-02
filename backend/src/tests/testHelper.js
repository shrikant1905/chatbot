import mysql from 'mysql2/promise';
import { runMigrations } from '../db/migrate.js';
import { getPool, closePool } from '../db/pool.js';
import { config } from '../config/index.js';

// Switch database to isolated test DB
config.db.database = 'kiaan_ai_test';

export async function initTestDatabase() {
  // Ensure the isolated test database exists before creating the pool
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });
  await connection.query('CREATE DATABASE IF NOT EXISTS `kiaan_ai_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
  await connection.end();

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
