import { getAiProvider } from '../services/ai/index.js';

export class ModelController {
  static async listModels(req, res, next) {
    try {
      const provider = getAiProvider();
      const status = await provider.checkAvailability();

      // Standard Kiaan model profiles
      const defaultKiaanModels = [
        { id: 'kiaan-ultra', name: 'Kiaan Ultra 4.5', description: 'Most capable model for deep reasoning, coding, and analysis', tag: 'Fast & Smart' },
        { id: 'kiaan-pro', name: 'Kiaan Pro 3.5', description: 'Optimized for high-speed conversational workflows', tag: 'Balanced' },
        { id: 'kiaan-code', name: 'Kiaan Code Alpha', description: 'Specialized checkpoint tuned for multi-file system design', tag: 'Code' }
      ];

      res.json({
        success: true,
        provider: provider.name,
        available: status.available,
        error: status.error || null,
        models: status.available && status.models?.length > 0 ? status.models : defaultKiaanModels
      });
    } catch (err) {
      next(err);
    }
  }
}

