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
   * Prevents token exhaustion and strictly filters out stopped/cancelled turns.
   */
  static async buildConversationContext(conversationId, limit = 10) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, role, content, status, created_at 
       FROM messages 
       WHERE conversation_id = ?
       ORDER BY created_at DESC 
       LIMIT ?`,
      [conversationId, limit]
    );

    // Return in chronological order
    if (!rows || rows.length === 0) return [];
    const chronological = rows.reverse();

    const context = [];
    for (let i = 0; i < chronological.length; i++) {
      const msg = chronological[i];
      const isLast = i === chronological.length - 1;

      if (isLast) {
        context.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
        continue;
      }

      if (msg.role === 'user') {
        const nextMsg = chronological[i + 1];
        if (nextMsg && nextMsg.role === 'assistant') {
          // If the previous response was stopped, cancelled, or aborted, completely discard this turn
          // so the model never answers the old aborted prompt!
          const isAborted =
            nextMsg.status === 'cancelled' ||
            nextMsg.status === 'failed' ||
            msg.status === 'cancelled' ||
            (nextMsg.content && nextMsg.content.includes('Generation was stopped by user'));

          if (isAborted) {
            i++; // Skip assistant message
            continue;
          }

          if (nextMsg.status === 'completed' && nextMsg.content && nextMsg.content.trim()) {
            context.push({ role: 'user', content: msg.content });
            context.push({ role: 'assistant', content: nextMsg.content });
            i++; // Skip assistant message as it is already paired
          }
        }
      }
    }

    return context.slice(-limit);
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
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [conversationId, parseInt(limit, 10), parseInt(offset, 10)]
    );
    return rows;
  }
}
