import { getPool } from '../db/pool.js';
import { AuthService } from '../services/authService.js';

/**
 * Authentication & Session Isolation Middleware
 * 
 * - If Bearer Token is provided: Validates user identity and sets req.user (isGuest: false).
 * - If Guest Mode (or no credentials): Sets req.user (isGuest: true). Guest chats are never stored in DB.
 * - Supports legacy/test X-User-Id header for test suite backward compatibility.
 */
export async function authMiddleware(req, res, next) {
  // 1. Check Bearer Token (Registered Logged-in User)
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const decoded = AuthService.verifyToken(token);

    if (decoded && decoded.id) {
      req.user = {
        id: decoded.id,
        name: decoded.name || 'User',
        email: decoded.email,
        isGuest: false
      };
      return next();
    }
  }

  // 2. Check Guest Mode header
  const isExplicitGuest = req.headers['x-guest-mode'] === 'true';
  const headerUserId = req.headers['x-user-id'];

  // If explicit guest or no user header provided, treat as Guest
  if (isExplicitGuest || !headerUserId || headerUserId === 'guest' || headerUserId === 'user_default') {
    req.user = {
      id: 'guest',
      name: 'Guest User',
      isGuest: true
    };
    return next();
  }

  // 3. Backward Compatibility for API Test Suites with X-User-Id
  req.user = {
    id: headerUserId,
    name: `User ${headerUserId.slice(-4)}`,
    isGuest: false
  };

  try {
    const pool = getPool();
    await pool.query(
      `INSERT IGNORE INTO users (id, name, email, avatar_initials, plan_badge)
       VALUES (?, ?, ?, 'KU', 'Active Member')`,
      [headerUserId, req.user.name, `${headerUserId}@device.local`]
    );
  } catch {
    // Non-blocking
  }

  next();
}
