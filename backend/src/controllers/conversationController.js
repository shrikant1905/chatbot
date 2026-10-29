import { ConversationService } from '../services/conversationService.js';

export class ConversationController {
  static async list(req, res, next) {
    try {
      const conversations = await ConversationService.listConversations(req.user.id);
      res.json({ success: true, conversations });
    } catch (err) {
      next(err);
    }
  }

  static async get(req, res, next) {
    try {
      const conversation = await ConversationService.getConversationById(req.params.id, req.user.id);
      if (!conversation) {
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      }
      res.json({ success: true, conversation });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const { id, title, model } = req.body;
      const conversation = await ConversationService.createConversation({
        id,
        userId: req.user.id,
        title,
        model
      });
      res.status(201).json({ success: true, conversation });
    } catch (err) {
      next(err);
    }
  }

  static async rename(req, res, next) {
    try {
      const { title } = req.body;
      const result = await ConversationService.renameConversation(req.params.id, req.user.id, title);
      res.json({ success: true, conversation: result });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const result = await ConversationService.deleteConversation(req.params.id, req.user.id);
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }

  static async clearMessages(req, res, next) {
    try {
      const result = await ConversationService.clearMessages(req.params.id, req.user.id);
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }
}

