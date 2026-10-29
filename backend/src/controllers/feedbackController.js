import { FeedbackService } from '../services/feedbackService.js';

export class FeedbackController {
  static async submit(req, res, next) {
    try {
      const { messageId, rating, comment } = req.body;
      const feedback = await FeedbackService.submitFeedback({
        messageId,
        rating,
        comment
      });
      res.status(201).json({ success: true, feedback });
    } catch (err) {
      next(err);
    }
  }
}

