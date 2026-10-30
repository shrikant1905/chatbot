import { getPool } from '../db/pool.js';

/**
 * Authentication & Session Isolation Middleware
 * Isolates conversations per device/browser using X-User-Id header.
 * Auto-creates unique user row in MySQL to satisfy foreign key constraints.
 */
export async function authMiddleware(req, res, next) {
  const headerUserId = req.headers['x-user-id'] || 'user_default';

  req.user = {
    id: headerUserId,
    name: headerUserId === 'user_default' ? 'Default User' : `User ${headerUserId.slice(-4)}`
  };

  try {
    const pool = getPool();
    // Auto-create user in DB if first time connecting
    await pool.query(
      `INSERT IGNORE INTO users (id, name, email, avatar_initials, plan_badge)
       VALUES (?, ?, ?, 'KU', 'Active Member')`,
      [headerUserId, req.user.name, `${headerUserId}@device.local`]
    );
  } catch (err) {
    // Non-blocking in case of DB reconnection
  }

  next();
}
