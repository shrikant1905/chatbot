import crypto from 'crypto';
import { getPool } from '../db/pool.js';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /token/i,
  /bearer/i,
  /auth/i,
  /credential/i,
  /private[_-]?key/i
];

export class MemoryService {
  /**
   * Get all persistent memories for a user.
   */
  static async getMemories(userId = 'user_default') {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, key_name, value_text, category, created_at, updated_at FROM user_memories WHERE user_id = ? ORDER BY key_name ASC',
      [userId]
    );
    return rows;
  }

  /**
   * Save or update a persistent memory item for a user.
   */
  static async saveMemory({ userId = 'user_default', keyName, valueText, category = 'general' }) {
    if (!keyName || !keyName.trim()) {
      throw new Error('Memory key name cannot be empty');
    }
    if (!valueText || !valueText.trim()) {
      throw new Error('Memory value cannot be empty');
    }

    const cleanKey = keyName.trim();
    const cleanValue = valueText.trim();

    // Security Guard: Prevent storing secrets as persistent memory
    for (const pattern of SENSITIVE_KEY_PATTERNS) {
      if (pattern.test(cleanKey) || pattern.test(cleanValue)) {
        throw new Error('Security policy violation: Cannot store sensitive credentials, keys, or passwords in conversational memory.');
      }
    }

    const pool = getPool();

    // Check if key already exists for this user
    const [existing] = await pool.query(
      'SELECT id FROM user_memories WHERE user_id = ? AND key_name = ?',
      [userId, cleanKey]
    );

    if (existing.length > 0) {
      await pool.query(
        'UPDATE user_memories SET value_text = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [cleanValue, category, existing[0].id]
      );
      const [updated] = await pool.query('SELECT * FROM user_memories WHERE id = ?', [existing[0].id]);
      return updated[0];
    } else {
      const id = crypto.randomUUID();
      await pool.query(
        'INSERT INTO user_memories (id, user_id, key_name, value_text, category) VALUES (?, ?, ?, ?, ?)',
        [id, userId, cleanKey, cleanValue, category]
      );
      const [created] = await pool.query('SELECT * FROM user_memories WHERE id = ?', [id]);
      return created[0];
    }
  }

  /**
   * Delete a memory item.
   */
  static async deleteMemory(id, userId = 'user_default') {
    const pool = getPool();
    const [result] = await pool.query('DELETE FROM user_memories WHERE id = ? AND user_id = ?', [id, userId]);
    if (result.affectedRows === 0) {
      throw new Error('Memory item not found or unauthorized');
    }
    return { success: true, id };
  }
}

