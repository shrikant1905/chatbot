import { config } from '../../config/index.js';
import { OllamaProvider } from './ollamaProvider.js';
import { OpenAiProvider } from './openaiProvider.js';
import { GeminiProvider } from './geminiProvider.js';
import { MockTestProvider } from './mockTestProvider.js';

let cachedProvider = null;

export function getAiProvider(overrideProvider = null) {
  const providerName = overrideProvider || config.ai.provider;

  if (cachedProvider && cachedProvider.name === providerName) {
    return cachedProvider;
  }

  switch (providerName) {
    case 'ollama':
      cachedProvider = new OllamaProvider(config.ai);
      break;
    case 'openai':
      cachedProvider = new OpenAiProvider(config.ai);
      break;
    case 'gemini':
      cachedProvider = new GeminiProvider(config.ai);
      break;
    case 'mock_test':
      cachedProvider = new MockTestProvider();
      break;
    default:
      console.warn(`Unknown AI provider "${providerName}", defaulting to Ollama`);
      cachedProvider = new OllamaProvider(config.ai);
  }

  return cachedProvider;
}

