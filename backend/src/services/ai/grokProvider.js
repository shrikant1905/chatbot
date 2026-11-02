import { AiProviderInterface } from './aiProviderInterface.js';
import fs from 'fs/promises';
import { TavilyService } from '../search/tavilyService.js';

export class GrokProvider extends AiProviderInterface {
  constructor(config = {}) {
    super('grok');
    this.apiKey = config.grokApiKey || process.env.GROK_API_KEY || '';
    this.baseUrl = (config.grokBaseUrl || process.env.GROK_BASE_URL || 'https://api.x.ai/v1').replace(/\/+$/, '');
    this.defaultModel = config.grokDefaultModel || process.env.GROK_DEFAULT_MODEL || 'grok-4.20-0309-non-reasoning';
  }

  /**
   * Verify xAI Grok API connection and retrieve supported models.
   */
  async checkAvailability() {
    if (!this.apiKey) {
      return {
        available: false,
        provider: this.name,
        models: [],
        error: 'xAI Grok API key is missing. Set GROK_API_KEY in backend/.env'
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return {
          available: false,
          provider: this.name,
          models: [],
          error: `xAI Grok returned HTTP ${res.status}`
        };
      }

      return {
        available: true,
        provider: this.name,
        models: [
          {
            id: 'grok-4.20-0309-non-reasoning',
            name: 'Grok 🚀 [xAI - Ultra Fast 700ms]',
            description: 'xAI Grok - High-speed conversational & coding intelligence with live internet grounding',
            tag: 'Fast',
            priority: 1
          },
          {
            id: 'grok-4.3',
            name: 'Grok 4.3 🧠 [xAI - Deep Reasoning]',
            description: 'xAI Grok 4.3 - Advanced multi-step reasoning, mathematical proof & complex system architecture',
            tag: 'Smart',
            priority: 2
          },
          {
            id: 'grok-4.20-0309-reasoning',
            name: 'Grok Reasoning ⚡ [xAI]',
            description: 'xAI Grok reasoning model with deep step-by-step thinking',
            tag: 'Deep',
            priority: 3
          }
        ]
      };
    } catch (err) {
      return {
        available: false,
        provider: this.name,
        models: [],
        error: `Grok health check failed: ${err.message}`
      };
    }
  }

  /**
   * Main Inference Dispatcher:
   * Supports streaming SSE chunks, Tavily search context, image vision attachments,
   * user memories, and instant cancellation via AbortSignal.
   */
  async generateResponse({
    model,
    messages = [],
    attachments = [],
    userMemories = [],
    webSearch = false,
    stream = false,
    onChunk,
    signal
  }) {
    if (!this.apiKey) {
      throw new Error('xAI Grok API key is not configured. Set GROK_API_KEY in backend/.env');
    }

    const selectedModel = model && model.startsWith('grok-') ? model : this.defaultModel;

    // 1. Build System Instructions (Clock, Memories, Identity)
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeFormatted = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const systemPromptParts = [
      `You are Kiaan AI, an intelligent, fast, and helpful AI assistant powered by xAI Grok.`,
      `[Temporal Anchor - CRITICAL]: The current real-world time is ${timeFormatted} on ${dateFormatted}. The current calendar year is ${now.getFullYear()}. Any events or data up to this point in ${now.getFullYear()} are present/past, not the future.`
    ];

    if (userMemories && userMemories.length > 0) {
      const memoryPrompt = userMemories
        .slice(0, 5)
        .map((m) => `- ${m.key_name}: ${m.value_text}`)
        .join('\n');
      systemPromptParts.push(`Relevant user preferences:\n${memoryPrompt}`);
    }

    // 2. Tavily Web Search Integration
    const lastUserMsg = messages[messages.length - 1];
    const lastUserPrompt = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

    if (TavilyService.isAvailable() && TavilyService.shouldSearch(lastUserPrompt, webSearch)) {
      try {
        const searchResults = await TavilyService.search(lastUserPrompt, { maxResults: 3, signal });
        if (searchResults && searchResults.results.length > 0) {
          const searchContext = TavilyService.formatForPrompt(searchResults);
          systemPromptParts.push(searchContext);
        }
      } catch (searchErr) {
        console.warn('[GrokProvider] Tavily web search skipped:', searchErr.message);
      }
    }

    const formattedMessages = [
      { role: 'system', content: systemPromptParts.join('\n\n') }
    ];

    // 3. Process Conversation History & Multimodal Attachments
    const historySlice = messages.slice(-10);

    for (let i = 0; i < historySlice.length; i++) {
      const msg = historySlice[i];
      const isLastMessage = i === historySlice.length - 1;
      const role = msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user';

      if (isLastMessage && attachments && attachments.length > 0) {
        const imageAttachments = attachments.filter((a) => a.mime_type?.startsWith('image/'));
        if (imageAttachments.length > 0) {
          const contentParts = [
            { type: 'text', text: msg.content || 'Analyze this image.' }
          ];

          for (const att of imageAttachments) {
            try {
              if (att.filepath) {
                const fileBuf = await fs.readFile(att.filepath);
                const base64 = fileBuf.toString('base64');
                contentParts.push({
                  type: 'image_url',
                  image_url: {
                    url: `data:${att.mime_type || 'image/jpeg'};base64,${base64}`
                  }
                });
              }
            } catch (imgErr) {
              console.warn('[GrokProvider] Failed to read attachment image:', imgErr.message);
            }
          }

          formattedMessages.push({ role, content: contentParts });
          continue;
        }
      }

      formattedMessages.push({
        role,
        content: msg.content || ''
      });
    }

    // 4. Dispatch Request to xAI API
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: formattedMessages,
        stream: Boolean(stream)
      }),
      signal
    });

    if (!response.ok) {
      let errDetail = '';
      try {
        const errJson = await response.json();
        errDetail = errJson.error?.message || JSON.stringify(errJson);
      } catch {
        errDetail = await response.text();
      }

      if (response.status === 401) {
        throw new Error('xAI Grok Authentication failed. Verify that GROK_API_KEY in backend/.env is valid.');
      } else if (response.status === 429) {
        throw new Error('xAI Grok Rate limit or quota exceeded. Please wait a moment and retry.');
      } else {
        throw new Error(`xAI Grok API Error (HTTP ${response.status}): ${errDetail}`);
      }
    }

    // 5. Stream Chunks (SSE) or Return Direct Result
    if (stream && onChunk) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedContent = '';
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
            if (!trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                accumulatedContent += delta;
                onChunk(delta);
              }
            } catch {
              // Ignore partial JSON lines
            }
          }
        }
      } catch (streamErr) {
        if (signal?.aborted) {
          throw new Error('Generation was stopped by user.');
        }
        throw streamErr;
      }

      return {
        content: accumulatedContent,
        model: selectedModel,
        tokensUsed: Math.ceil(accumulatedContent.length / 4)
      };
    } else {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      return {
        content,
        model: data.model || selectedModel,
        tokensUsed: data.usage?.total_tokens || Math.ceil(content.length / 4)
      };
    }
  }
}

