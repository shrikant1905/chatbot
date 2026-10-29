import { SearchService } from '../services/searchService.js';

export class SearchController {
  static async search(req, res, next) {
    try {
      const { q = '', limit = 20 } = req.query;
      if (!q.trim()) {
        return res.json({ success: true, query: '', conversations: [], messages: [], totalCount: 0 });
      }

      const results = await SearchService.search({
        userId: req.user.id,
        query: q,
        limit
      });

      res.json({ success: true, ...results });
    } catch (err) {
      next(err);
    }
  }

  static async getHistory(req, res, next) {
    try {
      const { limit = 15 } = req.query;
      const history = await SearchService.getSearchHistory(req.user.id, limit);
      res.json({ success: true, history });
    } catch (err) {
      next(err);
    }
  }

  static async deleteHistoryItem(req, res, next) {
    try {
      const { id } = req.params;
      const result = await SearchService.deleteSearchHistoryItem(id, req.user.id);
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }

  static async clearHistory(req, res, next) {
    try {
      const result = await SearchService.clearSearchHistory(req.user.id);
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }
}

