import { MemoryService } from '../services/memoryService.js';

export class MemoryController {
  static async getMemories(req, res, next) {
    try {
      const memories = await MemoryService.getMemories(req.user.id);
      res.json({ success: true, memories });
    } catch (err) {
      next(err);
    }
  }

  static async saveMemory(req, res, next) {
    try {
      const { keyName, valueText, category } = req.body;
      const memory = await MemoryService.saveMemory({
        userId: req.user.id,
        keyName,
        valueText,
        category
      });
      res.status(201).json({ success: true, memory });
    } catch (err) {
      next(err);
    }
  }

  static async deleteMemory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await MemoryService.deleteMemory(id, req.user.id);
      res.json({ success: true, result });
    } catch (err) {
      next(err);
    }
  }
}

