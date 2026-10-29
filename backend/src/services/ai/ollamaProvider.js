import { AiProviderInterface } from './aiProviderInterface.js';
import fs from 'fs/promises';

export class OllamaProvider extends AiProviderInterface {
  constructor(config) {
    super('ollama');
    this.baseUrl = (config.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.defaultModel = config.ollamaDefaultModel || 'llama3:latest';
  }

  async checkAvailability() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return {
          available: false,
          provider: this.name,
          models: [],
          error: `Ollama returned HTTP ${res.status}: ${res.statusText}`
        };
      }

      const data = await res.json();
      const models = (data.models || []).map((m) => ({
        id: m.name,
        name: m.name,
        tag: `${Math.round((m.size || 0) / 1024 / 1024 / 1024 * 10) / 10}GB`
      }));

      return {
        available: true,
        provider: this.name,
        models: models.length > 0 ? models : [{ id: this.defaultModel, name: this.defaultModel }],
        baseUrl: this.baseUrl
      };
    } catch (err) {
      const isConnectionRefused = err.cause?.code === 'ECONNREFUSED' || err.message?.includes('fetch failed');
      const errorMsg = isConnectionRefused
        ? `Ollama service is unreachable at ${this.baseUrl}. Ensure Ollama is running ('ollama serve') or update OLLAMA_BASE_URL.`
        : `Ollama health check error: ${err.message}`;

      return {
        available: false,
        provider: this.name,
        models: [],
        error: errorMsg
      };
    }
  }

  async generateResponse({ model, messages, attachments = [], userMemories = [], stream = false, onChunk, signal }) {
    const selectedModel = model || this.defaultModel;

    // Convert messages for Ollama format
    const formattedMessages = [];

    // If persistent user memories exist, prepend them into a system instruction message
    if (userMemories && userMemories.length > 0) {
      const memoryPrompt = userMemories
        .map((m) => `- ${m.key_name}: ${m.value_text}`)
        .join('\n');
      formattedMessages.push({
        role: 'system',
        content: `Relevant persistent user context:\n${memoryPrompt}`
      });
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLastMessage = i === messages.length - 1;
      const formatted = {
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msg.content
      };

      // If last message has image attachments, encode image files into base64 for multimodal vision models
      if (isLastMessage && attachments && attachments.length > 0) {
        const imageAttachments = attachments.filter((a) => a.mime_type?.startsWith('image/'));
        if (imageAttachments.length > 0) {
          const imagesBase64 = [];
          for (const att of imageAttachments) {
            try {
              const fileData = await fs.readFile(att.storage_path);
              imagesBase64.push(fileData.toString('base64'));
            } catch (readErr) {
              console.warn(`Could not read image attachment ${att.filename}:`, readErr.message);
            }
          }
          if (imagesBase64.length > 0) {
            formatted.images = imagesBase64;
          }
        }
      }

      formattedMessages.push(formatted);
    }

    const payload = {
      model: selectedModel,
      messages: formattedMessages,
      stream: Boolean(stream)
    };

    let response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') {
        throw new Error('Generation was cancelled by user.');
      }
      throw new Error(
        `Ollama generation failed: unable to connect to Ollama at ${this.baseUrl}. Verify that Ollama is running and has the '${selectedModel}' model installed ('ollama pull ${selectedModel}').`
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama API error (${response.status}): ${errText || response.statusText}`);
    }

    if (stream && onChunk) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.message?.content) {
                fullContent += parsed.message.content;
                onChunk(parsed.message.content);
              }
            } catch {
              // Ignore partial JSON line
            }
          }
        }
      } catch (streamErr) {
        if (streamErr.name === 'AbortError') {
          throw new Error('Generation was cancelled by user.');
        }
        throw streamErr;
      }

      return {
        content: fullContent,
        model: selectedModel
      };
    } else {
      const data = await response.json();
      return {
        content: data.message?.content || '',
        model: selectedModel,
        tokensUsed: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      };
    }
  }
}

