import { getAiProvider } from '../services/ai/index.js';
import { config } from '../config/index.js';

export class ModelController {
  static async listModels(req, res, next) {
    try {
      const primaryProvider = getAiProvider();
      const primaryStatus = await primaryProvider.checkAvailability();

      let combinedModels = primaryStatus.available && primaryStatus.models?.length > 0
        ? [...primaryStatus.models]
        : [];

      // If primary is Ollama and Grok is configured, also surface Grok models in dropdown
      if (primaryProvider.name !== 'grok' && (config.ai.grokApiKey || process.env.GROK_API_KEY)) {
        try {
          const grokProvider = getAiProvider('grok');
          const grokStatus = await grokProvider.checkAvailability();
          if (grokStatus.available && grokStatus.models?.length > 0) {
            combinedModels.push(...grokStatus.models);
          }
        } catch {
          // Non-blocking
        }
      }

      // Default fallback if no models were loaded
      const defaultKiaanModels = [
        { id: 'gemma3:4b', name: 'Gemma 3 (4B) 🌟 [Default]', description: 'Google Gemma 3 - Deep reasoning, rich formatting & high quality', tag: 'Default' },
        { id: 'grok-4.20-0309-non-reasoning', name: 'Grok 🚀 [xAI - Ultra Fast 700ms]', description: 'xAI Grok high speed conversational intelligence', tag: 'Fast' }
      ];

      res.json({
        success: true,
        provider: primaryProvider.name,
        available: primaryStatus.available,
        error: primaryStatus.error || null,
        models: combinedModels.length > 0 ? combinedModels : defaultKiaanModels
      });
    } catch (err) {
      next(err);
    }
  }
}
