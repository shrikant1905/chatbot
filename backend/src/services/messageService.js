import crypto from 'crypto';
import { getPool } from '../db/pool.js';

export class MessageService {
  /**
   * Save a user message.
   */
  static async saveUserMessage({ id, conversationId, content, model = null }) {
    if (!content || !content.trim()) {
      throw new Error('Message content cannot be empty');
    }
    const pool = getPool();
    const messageId = id || crypto.randomUUID();

    await pool.query(
      `INSERT INTO messages (id, conversation_id, role, content, status, model)
       VALUES (?, ?, 'user', ?, 'completed', ?)`,
      [messageId, conversationId, content.trim(), model]
    );

    // Update conversation timestamp
    await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);

    const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [messageId]);
    return rows[0];
  }

  /**
   * Save an assistant message.
   */
  static async saveAssistantMessage({ id, conversationId, content, status = 'completed', model = null, tokensUsed = 0 }) {
    const pool = getPool();
    const messageId = id || crypto.randomUUID();

    await pool.query(
      `INSERT INTO messages (id, conversation_id, role, content, status, model, tokens_used)
       VALUES (?, ?, 'assistant', ?, ?, ?, ?)`,
      [messageId, conversationId, content || '', status, model, tokensUsed]
    );

    // Update conversation timestamp
    await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);

    const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [messageId]);
    return rows[0];
  }

  /**
   * Update message content and status (for streaming or failures).
   */
  static async updateMessage(id, { content, status, tokensUsed }) {
    const pool = getPool();
    const updates = [];
    const params = [];

    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (tokensUsed !== undefined) {
      updates.push('tokens_used = ?');
      params.push(tokensUsed);
    }

    if (updates.length === 0) return null;

    params.push(id);
    await pool.query(`UPDATE messages SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [id]);
    return rows[0];
  }

  /**
   * Build bounded context window (recent messages) for AI generation.
   * Prevents token exhaustion and keeps conversations focused.
   */
  static async buildConversationContext(conversationId, limit = 10) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, role, content, status, created_at 
       FROM messages 
       WHERE conversation_id = ? AND status = 'completed'
       ORDER BY created_at DESC 
       LIMIT ?`,
      [conversationId, limit]
    );

    // Return in chronological order
    return rows.reverse();
  }

  /**
   * List messages with pagination.
   */
  static async listMessages(conversationId, { limit = 50, offset = 0 } = {}) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, conversation_id, role, content, status, model, tokens_used, created_at 
       FROM messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC 
       LIMIT ? OFFSET ?`,
      [conversationId, parseInt(limit, 10), parseInt(offset, 10)]
    );
    return rows;
  }
}

