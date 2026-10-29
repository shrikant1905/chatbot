import { AiProviderInterface } from './aiProviderInterface.js';

export class OpenAiProvider extends AiProviderInterface {
  constructor(config) {
    super('openai');
    this.apiKey = config.openaiApiKey || '';
    this.baseUrl = (config.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.defaultModel = 'gpt-4o-mini';
  }

  async checkAvailability() {
    if (!this.apiKey) {
      return {
        available: false,
        provider: this.name,
        models: [],
        error: 'OpenAI API key is missing. Set OPENAI_API_KEY in backend/.env'
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      if (!res.ok) {
        return {
          available: false,
          provider: this.name,
          models: [],
          error: `OpenAI returned status ${res.status}`
        };
      }
      return {
        available: true,
        provider: this.name,
        models: [
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Fast' },
          { id: 'gpt-4o', name: 'GPT-4o', tag: 'Smart' }
        ]
      };
    } catch (err) {
      return {
        available: false,
        provider: this.name,
        models: [],
        error: `OpenAI check failed: ${err.message}`
      };
    }
  }

  async generateResponse({ model, messages, stream = false, onChunk, signal }) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured. Add OPENAI_API_KEY to backend/.env');
    }

    const selectedModel = model || this.defaultModel;
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content
    }));

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: formattedMessages,
        stream
      }),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    if (stream && onChunk) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta);
            }
          } catch {
            // Ignore partial JSON
          }
        }
      }

      return { content: fullContent, model: selectedModel };
    } else {
      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        model: selectedModel,
        tokensUsed: data.usage?.total_tokens || 0
      };
    }
  }
}

