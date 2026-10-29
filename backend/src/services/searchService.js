import crypto from 'crypto';
import { getPool } from '../db/pool.js';

export class SearchService {
  /**
   * Search conversations and messages for a query.
   */
  static async search({ userId = 'user_default', query, limit = 20 }) {
    if (!query || !query.trim()) {
      return { query: '', results: [] };
    }

    const trimmedQuery = query.trim();
    const searchPattern = `%${trimmedQuery}%`;
    const pool = getPool();

    // Search conversations by title
    const [matchingConversations] = await pool.query(
      `SELECT id, title, model, created_at, updated_at, 'conversation' AS match_type, title AS snippet
       FROM conversations
       WHERE user_id = ? AND title LIKE ?
       ORDER BY updated_at DESC
       LIMIT ?`,
      [userId, searchPattern, parseInt(limit, 10)]
    );

    // Search messages by content
    const [matchingMessages] = await pool.query(
      `SELECT 
         m.id AS message_id,
         m.conversation_id,
         m.role,
         m.content AS snippet,
         m.created_at,
         c.title AS conversation_title,
         'message' AS match_type
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = ? AND m.content LIKE ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [userId, searchPattern, parseInt(limit, 10)]
    );

    const totalResults = matchingConversations.length + matchingMessages.length;

    // Persist search query to history
    await this.saveSearchQuery({
      userId,
      query: trimmedQuery,
      resultCount: totalResults
    });

    return {
      query: trimmedQuery,
      conversations: matchingConversations,
      messages: matchingMessages,
      totalCount: totalResults
    };
  }

  /**
   * Save a search query to search_history.
   */
  static async saveSearchQuery({ userId = 'user_default', query, resultCount = 0 }) {
    const pool = getPool();
    const id = crypto.randomUUID();

    // Avoid duplicate rapid saves for the exact same query within 5 seconds
    const [recent] = await pool.query(
      `SELECT id FROM search_history 
       WHERE user_id = ? AND query = ? AND created_at >= (NOW() - INTERVAL 5 SECOND)`,
      [userId, query]
    );

    if (recent.length === 0) {
      await pool.query(
        'INSERT INTO search_history (id, user_id, query, result_count) VALUES (?, ?, ?, ?)',
        [id, userId, query, resultCount]
      );
    }
  }

  /**
   * Get recent search history for a user.
   */
  static async getSearchHistory(userId = 'user_default', limit = 15) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, query, result_count, created_at 
       FROM search_history 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, parseInt(limit, 10)]
    );
    return rows;
  }

  /**
   * Delete a single search history item.
   */
  static async deleteSearchHistoryItem(id, userId = 'user_default') {
    const pool = getPool();
    await pool.query('DELETE FROM search_history WHERE id = ? AND user_id = ?', [id, userId]);
    return { success: true, id };
  }

  /**
   * Clear all search history for a user.
   */
  static async clearSearchHistory(userId = 'user_default') {
    const pool = getPool();
    await pool.query('DELETE FROM search_history WHERE user_id = ?', [userId]);
    return { success: true };
  }
}

