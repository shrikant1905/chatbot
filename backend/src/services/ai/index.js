import { config } from '../../config/index.js';
import { OllamaProvider } from './ollamaProvider.js';
import { OpenAiProvider } from './openaiProvider.js';
import { GeminiProvider } from './geminiProvider.js';
import { GrokProvider } from './grokProvider.js';
import { MockTestProvider } from './mockTestProvider.js';

const cachedProviders = new Map();

/**
 * Returns an instance of the requested AI provider, reusing cached singletons.
 */
export function getAiProvider(overrideProvider = null) {
  const providerName = overrideProvider || config.ai.provider;

  if (cachedProviders.has(providerName)) {
    return cachedProviders.get(providerName);
  }

  let provider = null;
  switch (providerName) {
    case 'grok':
      provider = new GrokProvider(config.ai);
      break;
    case 'ollama':
      provider = new OllamaProvider(config.ai);
      break;
    case 'openai':
      provider = new OpenAiProvider(config.ai);
      break;
    case 'gemini':
      provider = new GeminiProvider(config.ai);
      break;
    case 'mock_test':
      provider = new MockTestProvider();
      break;
    default:
      console.warn(`Unknown AI provider "${providerName}", defaulting to Ollama`);
      provider = new OllamaProvider(config.ai);
  }

  cachedProviders.set(providerName, provider);
  return provider;
}

/**
 * Smart Hybrid Router:
 * Dynamically resolves the appropriate AI provider based on the user's selected model.
 * If user selects a Grok model, routes to GrokProvider.
 * If user selects Gemma/Qwen/Ollama model, routes to OllamaProvider.
 */
export function resolveAiProvider(modelName) {
  if (typeof modelName === 'string') {
    if (modelName.startsWith('grok-') || modelName.includes('grok')) {
      return getAiProvider('grok');
    }
    if (modelName.startsWith('gpt-')) {
      return getAiProvider('openai');
    }
    if (modelName.startsWith('gemini-')) {
      return getAiProvider('gemini');
    }
  }

  // Fallback to active system provider (Ollama by default)
  return getAiProvider();
}
