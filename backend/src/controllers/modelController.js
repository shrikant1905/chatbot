import { getAiProvider } from '../services/ai/index.js';
import { config } from '../config/index.js';

export class ModelController {
  static async listModels(req, res, next) {
    try {
      const grokModels = [];
      const ollamaModels = [];

      // 1. Fetch Grok models first (Priority #1: Ultra-fast 700ms responses)
      if (config.ai.grokApiKey || process.env.GROK_API_KEY) {
        try {
          const grokProvider = getAiProvider('grok');
          const grokStatus = await grokProvider.checkAvailability();
          if (grokStatus.available && grokStatus.models?.length > 0) {
            grokModels.push(...grokStatus.models);
          }
        } catch {
          // Non-blocking
        }
      }

      // 2. Fetch Ollama models
      try {
        const ollamaProvider = getAiProvider('ollama');
        const ollamaStatus = await ollamaProvider.checkAvailability();
        if (ollamaStatus.available && ollamaStatus.models?.length > 0) {
          ollamaModels.push(...ollamaStatus.models);
        }
      } catch {
        // Non-blocking
      }

      // Grok models take precedence at the top, followed by Ollama
      const combinedModels = [...grokModels, ...ollamaModels];

      // Default fallback if no models were loaded
      const defaultKiaanModels = [
        { id: 'grok-4.20-0309-non-reasoning', name: 'Grok 🚀 [xAI - Ultra Fast 700ms]', description: 'xAI Grok high speed conversational intelligence', tag: 'Fast' },
        { id: 'gemma3:4b', name: 'Gemma 3 (4B) 🌟 [Default]', description: 'Google Gemma 3 - Deep reasoning, rich formatting & high quality', tag: 'Default' }
      ];

      res.json({
        success: true,
        provider: grokModels.length > 0 ? 'grok' : 'ollama',
        available: combinedModels.length > 0,
        error: null,
        models: combinedModels.length > 0 ? combinedModels : defaultKiaanModels
      });
    } catch (err) {
      next(err);
    }
  }
}
