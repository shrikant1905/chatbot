import crypto from 'crypto';
import fs from 'fs/promises';
import { getPool } from '../db/pool.js';

export class AttachmentService {
  /**
   * Save uploaded file record to database.
   */
  static async saveAttachment({
    id,
    conversationId,
    messageId = null,
    filename,
    originalName,
    mimeType,
    fileSize,
    storagePath
  }) {
    const pool = getPool();
    const attId = id || crypto.randomUUID();

    await pool.query(
      `INSERT INTO attachments (id, conversation_id, message_id, filename, original_name, mime_type, file_size, storage_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [attId, conversationId, messageId, filename, originalName, mimeType, fileSize, storagePath]
    );

    const [rows] = await pool.query('SELECT * FROM attachments WHERE id = ?', [attId]);
    return {
      ...rows[0],
      url: `/api/attachments/${attId}/file`
    };
  }

  /**
   * Associate attachments with a message ID.
   */
  static async linkAttachmentsToMessage(attachmentIds = [], messageId) {
    if (!attachmentIds || attachmentIds.length === 0) return;
    const pool = getPool();
    const placeholders = attachmentIds.map(() => '?').join(',');
    await pool.query(
      `UPDATE attachments SET message_id = ? WHERE id IN (${placeholders})`,
      [messageId, ...attachmentIds]
    );
  }

  /**
   * Get attachment by ID with ownership check.
   */
  static async getAttachmentById(id, userId = 'user_default') {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT a.* 
       FROM attachments a
       JOIN conversations c ON a.conversation_id = c.id
       WHERE a.id = ? AND c.user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0) {
      return null;
    }

    return {
      ...rows[0],
      url: `/api/attachments/${id}/file`
    };
  }

  /**
   * Delete attachment from DB and disk.
   */
  static async deleteAttachment(id, userId = 'user_default') {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT a.storage_path 
       FROM attachments a
       JOIN conversations c ON a.conversation_id = c.id
       WHERE a.id = ? AND c.user_id = ?`,
      [id, userId]
    );

    if (rows.length === 0) {
      throw new Error('Attachment not found or unauthorized');
    }

    const { storage_path } = rows[0];

    await pool.query('DELETE FROM attachments WHERE id = ?', [id]);

    try {
      await fs.unlink(storage_path);
    } catch {}

    return { success: true, id };
  }
}

