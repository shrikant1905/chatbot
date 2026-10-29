import mysql from 'mysql2/promise';
import { config } from '../config/index.js';

let pool = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: config.db.connectionLimit,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: '+00:00', // Consistent UTC handling
      dateStrings: true
    });
  }
  return pool;
}

export async function testConnection() {
  const p = getPool();
  const [rows] = await p.query('SELECT 1 + 1 AS result');
  return rows[0]?.result === 2;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

