/**
 * Base AI Provider Interface
 * All AI provider implementations must implement these methods.
 */
export class AiProviderInterface {
  constructor(name) {
    this.name = name;
  }

  /**
   * Check if the provider is reachable and configured.
   * @returns {Promise<{ available: boolean, provider: string, models: Array<{ id: string, name: string, tag?: string }>, error?: string }>}
   */
  async checkAvailability() {
    throw new Error('checkAvailability() must be implemented by subclass');
  }

  /**
   * Generate an AI response for conversation messages.
   * @param {Object} options
   * @param {string} options.model - Requested model identifier
   * @param {Array<{ role: string, content: string }>} options.messages - Context messages
   * @param {Array<Object>} [options.attachments] - Validated attachments
   * @param {Array<Object>} [options.userMemories] - User memory items
   * @param {boolean} [options.stream] - Whether to stream response chunks
   * @param {Function} [options.onChunk] - Callback for streaming chunks
   * @param {AbortSignal} [options.signal] - Cancellation signal
   * @returns {Promise<{ content: string, model: string, tokensUsed?: number }>}
   */
  async generateResponse(options) {
    throw new Error('generateResponse() must be implemented by subclass');
  }
}

