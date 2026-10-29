import { AiProviderInterface } from './aiProviderInterface.js';

export class MockTestProvider extends AiProviderInterface {
  constructor() {
    super('mock_test');
    this.available = true;
  }

  async checkAvailability() {
    return {
      available: true,
      provider: this.name,
      models: [
        { id: 'kiaan-ultra', name: 'Kiaan Ultra 4.5', tag: 'Fast & Smart' },
        { id: 'kiaan-pro', name: 'Kiaan Pro 3.5', tag: 'Balanced' },
        { id: 'kiaan-code', name: 'Kiaan Code Alpha', tag: 'Code' }
      ]
    };
  }

  async generateResponse({ model = 'kiaan-ultra', messages = [], stream = false, onChunk, signal }) {
    if (signal?.aborted) {
      throw new Error('Generation was cancelled by user.');
    }

    const lastMessage = messages[messages.length - 1]?.content || '';
    const generatedText = `[Test AI Response for "${lastMessage}"] Response generated with context size ${messages.length}.`;

    if (stream && onChunk) {
      const parts = generatedText.split(' ');
      for (const part of parts) {
        if (signal?.aborted) throw new Error('Generation was cancelled by user.');
        onChunk(part + ' ');
      }
    }

    return {
      content: generatedText,
      model,
      tokensUsed: 42
    };
  }
}

