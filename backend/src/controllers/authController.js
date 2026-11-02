import { AuthService } from '../services/authService.js';

export class AuthController {
  /**
   * POST /api/auth/register
   * Body: { name, email, password }
   */
  static async register(req, res) {
    try {
      const { name, email, password } = req.body;
      const result = await AuthService.register({ name, email, password });
      return res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        ...result
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Registration failed.'
      });
    }
  }

  /**
   * POST /api/auth/login
   * Body: { email, password }
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });
      return res.json({
        success: true,
        message: 'Logged in successfully!',
        ...result
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: err.message || 'Login failed.'
      });
    }
  }

  /**
   * GET /api/auth/me
   * Requires Authorization header. Returns current logged-in user or guest info.
   */
  static async me(req, res) {
    try {
      if (!req.user || req.user.isGuest) {
        return res.json({
          success: true,
          authenticated: false,
          user: null,
          isGuest: true
        });
      }

      const user = await AuthService.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          authenticated: false,
          error: 'User account not found.'
        });
      }

      return res.json({
        success: true,
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_initials: user.avatar_initials,
          plan_badge: user.plan_badge,
          created_at: user.created_at
        },
        isGuest: false
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

