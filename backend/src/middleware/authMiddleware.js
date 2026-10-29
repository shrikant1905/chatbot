/**
 * Authentication Middleware for local development and future production auth
 */
export function authMiddleware(req, res, next) {
  // Allows header override for multi-user testing: X-User-Id
  const headerUserId = req.headers['x-user-id'];
  req.user = {
    id: headerUserId || 'user_default',
    name: 'Alex Morgan'
  };
  next();
}

