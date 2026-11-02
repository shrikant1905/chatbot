import crypto from 'crypto';
import { getPool } from '../db/pool.js';
import { config } from '../config/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'kiaan-ai-super-secret-jwt-key-2026';

export class AuthService {
  /**
   * Hash a plain-text password using native scrypt with a unique random salt.
   */
  static hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Securely verify a plain-text password against a stored salt:hash string.
   */
  static verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, key] = storedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }

  /**
   * Generate a signed base64url authentication token (HMAC-SHA256).
   */
  static generateToken(user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days validity
      })
    ).toString('base64url');

    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Verify and decode a token. Returns null if invalid or expired.
   */
  static verifyToken(tokenStr) {
    if (!tokenStr || typeof tokenStr !== 'string') return null;
    const parts = tokenStr.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (decoded.exp && Date.now() > decoded.exp) {
        return null; // Expired
      }
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Register a new user account.
   */
  static async register({ name, email, password }) {
    if (!email || !email.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    const cleanName = (name || email.split('@')[0]).trim();

    const pool = getPool();

    // Check if email already registered
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing && existing.length > 0) {
      throw new Error('An account with this email address already exists. Please log in.');
    }

    // Compute initials (e.g. "Rohit Sharma" -> "RS", "Rohit" -> "RO")
    const words = cleanName.split(/\s+/).filter(Boolean);
    let initials = 'AM';
    if (words.length >= 2) {
      initials = (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1 && words[0].length >= 2) {
      initials = words[0].slice(0, 2).toUpperCase();
    } else if (words.length === 1) {
      initials = words[0][0].toUpperCase() + 'I';
    }

    const userId = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = this.hashPassword(password);
    const cleanEmail = email.toLowerCase().trim();

    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, avatar_initials, plan_badge)
       VALUES (?, ?, ?, ?, ?, 'Pro Member')`,
      [userId, cleanName, cleanEmail, passwordHash, initials]
    );

    const user = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      avatar_initials: initials,
      plan_badge: 'Pro Member'
    };

    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * Log in an existing user with email and password.
   */
  static async login({ email, password }) {
    if (!email || !password) {
      throw new Error('Please enter both email and password.');
    }

    const pool = getPool();
    const cleanEmail = email.toLowerCase().trim();

    const [rows] = await pool.query(
      `SELECT id, name, email, password_hash, avatar_initials, plan_badge, created_at
       FROM users WHERE email = ? OR name = ?`,
      [cleanEmail, email.trim()]
    );

    if (!rows || rows.length === 0) {
      throw new Error('No account found with this email or username.');
    }

    const userRow = rows[0];

    if (!userRow.password_hash) {
      throw new Error('This account does not have a password set. Please register or contact support.');
    }

    const isValid = this.verifyPassword(password, userRow.password_hash);
    if (!isValid) {
      throw new Error('Incorrect password. Please try again.');
    }

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      avatar_initials: userRow.avatar_initials || 'KU',
      plan_badge: userRow.plan_badge || 'Pro Member'
    };

    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * Fetch user details by ID.
   */
  static async getUserById(userId) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, name, email, avatar_initials, plan_badge, created_at
       FROM users WHERE id = ?`,
      [userId]
    );
    return rows[0] || null;
  }
}

