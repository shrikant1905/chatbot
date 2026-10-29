import crypto from 'crypto';
import fs from 'fs/promises';
import { getPool } from '../db/pool.js';

export class ConversationService {
  /**
   * List all conversations for a user, ordered by updated_at descending.
   */
  static async listConversations(userId = 'user_default') {
    const pool = getPool();
    const query = `
      SELECT 
        c.id,
        c.title,
        c.model,
        c.created_at,
        c.updated_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) AS message_count
      FROM conversations c
      WHERE c.user_id = ?
      ORDER BY c.updated_at DESC
    `;
    const [rows] = await pool.query(query, [userId]);
    return rows;
  }

  /**
   * Get single conversation with all its messages and attachments.
   */
  static async getConversationById(id, userId = 'user_default') {
    const pool = getPool();
    const [convRows] = await pool.query(
      'SELECT id, user_id, title, model, created_at, updated_at FROM conversations WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (convRows.length === 0) {
      return null;
    }

    const conv = convRows[0];

    // Fetch messages
    const [msgRows] = await pool.query(
      'SELECT id, role, content, status, model, tokens_used, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [id]
    );

    // Fetch attachments for this conversation
    const [attRows] = await pool.query(
      'SELECT id, message_id, filename, original_name, mime_type, file_size, created_at FROM attachments WHERE conversation_id = ?',
      [id]
    );

    // Map attachments to messages
    const attachmentsByMessageId = {};
    for (const att of attRows) {
      if (att.message_id) {
        if (!attachmentsByMessageId[att.message_id]) {
          attachmentsByMessageId[att.message_id] = [];
        }
        attachmentsByMessageId[att.message_id].push({
          ...att,
          url: `/api/attachments/${att.id}/file`
        });
      }
    }

    const messages = msgRows.map((m) => ({
      ...m,
      attachments: attachmentsByMessageId[m.id] || []
    }));

    return {
      ...conv,
      messages
    };
  }

  /**
   * Create a new conversation.
   */
  static async createConversation({ id, userId = 'user_default', title = 'New Conversation', model = 'kiaan-ultra' }) {
    const pool = getPool();
    const convId = id || crypto.randomUUID();

    await pool.query(
      'INSERT INTO conversations (id, user_id, title, model) VALUES (?, ?, ?, ?)',
      [convId, userId, title, model]
    );

    return {
      id: convId,
      user_id: userId,
      title,
      model,
      messages: []
    };
  }

  /**
   * Rename an existing conversation.
   */
  static async renameConversation(id, userId = 'user_default', newTitle) {
    if (!newTitle || !newTitle.trim()) {
      throw new Error('Title cannot be empty');
    }
    const pool = getPool();
    const [result] = await pool.query(
      'UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [newTitle.trim(), id, userId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Conversation not found or unauthorized');
    }

    return { id, title: newTitle.trim() };
  }

  /**
   * Delete a conversation, cascading DB records and cleaning up disk files.
   */
  static async deleteConversation(id, userId = 'user_default') {
    const pool = getPool();

    // Verify ownership and get attachments to clean up from filesystem
    const [attRows] = await pool.query(
      `SELECT a.storage_path 
       FROM attachments a 
       JOIN conversations c ON a.conversation_id = c.id 
       WHERE c.id = ? AND c.user_id = ?`,
      [id, userId]
    );

    // Delete conversation from DB (cascades to messages, attachments, feedback)
    const [result] = await pool.query(
      'DELETE FROM conversations WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Conversation not found or unauthorized');
    }

    // Clean up physical files from disk asynchronously
    for (const att of attRows) {
      try {
        await fs.unlink(att.storage_path);
      } catch (err) {
        // Ignore file cleanup error if already removed
      }
    }

    return { success: true, id };
  }

  /**
   * Clear all messages in a conversation.
   */
  static async clearMessages(id, userId = 'user_default') {
    const pool = getPool();

    // Verify ownership
    const [convRows] = await pool.query(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (convRows.length === 0) {
      throw new Error('Conversation not found or unauthorized');
    }

    // Clean up attachments
    const [attRows] = await pool.query('SELECT storage_path FROM attachments WHERE conversation_id = ?', [id]);
    for (const att of attRows) {
      try {
        await fs.unlink(att.storage_path);
      } catch {}
    }

    await pool.query('DELETE FROM messages WHERE conversation_id = ?', [id]);
    await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    return { success: true, conversationId: id };
  }
}

