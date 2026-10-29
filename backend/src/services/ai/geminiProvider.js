import { AiProviderInterface } from './aiProviderInterface.js';

export class GeminiProvider extends AiProviderInterface {
  constructor(config) {
    super('gemini');
    this.apiKey = config.geminiApiKey || '';
    this.defaultModel = 'gemini-1.5-flash';
  }

  async checkAvailability() {
    if (!this.apiKey) {
      return {
        available: false,
        provider: this.name,
        models: [],
        error: 'Gemini API key is missing. Set GEMINI_API_KEY in backend/.env'
      };
    }
    return {
      available: true,
      provider: this.name,
      models: [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Fast' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: 'Reasoning' }
      ]
    };
  }

  async generateResponse({ model, messages, stream = false, onChunk, signal }) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured. Add GEMINI_API_KEY in backend/.env');
    }

    const selectedModel = model || this.defaultModel;
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
      signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (stream && onChunk) {
      onChunk(text);
    }
    return { content: text, model: selectedModel };
  }
}

