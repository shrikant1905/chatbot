import crypto from 'crypto';
import { getPool } from '../db/pool.js';

export class FeedbackService {
  static async submitFeedback({ messageId, rating, comment = null }) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }
    if (!['like', 'dislike'].includes(rating)) {
      throw new Error("Rating must be 'like' or 'dislike'");
    }

    const pool = getPool();

    // Check message exists
    const [msg] = await pool.query('SELECT id FROM messages WHERE id = ?', [messageId]);
    if (msg.length === 0) {
      throw new Error('Message not found');
    }

    // Check if feedback already exists for this message, if so update it
    const [existing] = await pool.query('SELECT id FROM feedback WHERE message_id = ?', [messageId]);
    if (existing.length > 0) {
      await pool.query(
        'UPDATE feedback SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
        [rating, comment, existing[0].id]
      );
      return { id: existing[0].id, messageId, rating, comment };
    }

    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO feedback (id, message_id, rating, comment) VALUES (?, ?, ?, ?)',
      [id, messageId, rating, comment]
    );

    return { id, messageId, rating, comment };
  }
}

