import { AiProviderInterface } from './aiProviderInterface.js';
import fs from 'fs/promises';
import { concurrencyQueue } from '../queue/concurrencyQueue.js';
import { ToolRegistry } from '../tools/toolRegistry.js';

export class OllamaProvider extends AiProviderInterface {
  constructor(config) {
    super('ollama');
    this.baseUrl = (config.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.defaultModel = config.ollamaDefaultModel || 'qwen3:1.7b';
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
    let selectedModel = model || this.defaultModel;

    // Gracefully map placeholder/mock IDs to the real default model configured on the server
    if (typeof selectedModel === 'string' && selectedModel.startsWith('kiaan-')) {
      selectedModel = this.defaultModel;
    }

    // Wrap execution inside the concurrency governor queue (Rate Limiter & Hot Cache)
    return concurrencyQueue.enqueue(
      async () => {
        return this._executeOllamaInference({
          selectedModel,
          messages,
          attachments,
          userMemories,
          stream,
          onChunk,
          signal
        });
      },
      { model: selectedModel, messages, signal }
    );
  }

  /**
   * Fast 0ms Intent Router: Selects ONLY 1-3 relevant tools if the user asked
   * for an operational task. Returns 0 tools for standard chat (preventing CPU overload).
   */
  async _selectTargetedTools(userMessage, hasImages = false) {
    if (hasImages || !userMessage || typeof userMessage !== 'string') {
      return [];
    }

    const lower = userMessage.toLowerCase();
    const domainKeywords = {
      sales: ['lead', 'deal', 'crm', 'prospect', 'pipeline'],
      inventory: ['stock', 'inventory', 'sku', 'warehouse', 'reorder', 'shipment'],
      billing: ['invoice', 'billing', 'prorat', 'receipt', 'charge', 'subscription', 'mrr'],
      hr: ['leave', 'attendance', 'vacation', 'paystub', 'salary', 'handbook', 'interview'],
      support: ['ticket', 'helpdesk', 'support', 'escalat', 'complaint'],
      marketing: ['campaign', 'newsletter', 'broadcast', 'segment'],
      analytics: ['churn', 'kpi', 'revenue report', 'analytics', 'forecast', 'retention'],
      automation: ['webhook', 'delayed action', 'scheduled job', 'contract rule']
    };

    let matchedDomain = null;
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        matchedDomain = domain;
        break;
      }
    }

    if (!matchedDomain) {
      return []; // ZERO tools for 95% of queries -> instant 1-2 second response!
    }

    const domainTools = await ToolRegistry.getToolsForAi(matchedDomain);
    return domainTools.slice(0, 3); // Max 3 tools to keep prompt lightweight
  }

  async _executeOllamaInference({ selectedModel, messages, attachments, userMemories, stream, onChunk, signal }) {
    // 1. Format messages for Ollama
    const formattedMessages = [];

    const systemPromptParts = [
      'You are Kiaan AI, an intelligent, helpful, and fast enterprise assistant.',
      'Answer directly, concisely, and immediately in clear points or sentences without conversational filler.'
    ];

    if (userMemories && userMemories.length > 0) {
      const memoryPrompt = userMemories
        .map((m) => `- ${m.key_name}: ${m.value_text}`)
        .join('\n');
      systemPromptParts.push(`Relevant user context:\n${memoryPrompt}`);
    }

    formattedMessages.push({
      role: 'system',
      content: systemPromptParts.join('\n\n')
    });

    let hasImages = false;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLastMessage = i === messages.length - 1;
      const formatted = {
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msg.role === 'assistant' && !isLastMessage && msg.content
          ? msg.content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
          : msg.content
      };

      if (isLastMessage && attachments && attachments.length > 0) {
        // 1. Process Images for Vision models (qwen2.5vl:3b)
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
            hasImages = true;
            // Auto-switch to vision model if current selected model is text-only
            if (!selectedModel.includes('vl') && !selectedModel.includes('vision') && !selectedModel.includes('llava')) {
              selectedModel = process.env.OLLAMA_VISION_MODEL || 'qwen2.5vl:3b';
            }
          }
        }

        // 2. Process Text/Document Attachments (.txt, .md, .json, .csv)
        const docAttachments = attachments.filter((a) =>
          a.mime_type?.startsWith('text/') ||
          a.mime_type === 'application/json' ||
          a.original_name?.endsWith('.txt') ||
          a.original_name?.endsWith('.md') ||
          a.original_name?.endsWith('.json') ||
          a.original_name?.endsWith('.csv')
        );
        for (const doc of docAttachments) {
          try {
            const textContent = await fs.readFile(doc.storage_path, 'utf-8');
            formatted.content += `\n\n--- [Attached Document: ${doc.original_name}] ---\n${textContent.slice(0, 10000)}\n--- [End of Document] ---`;
          } catch (readErr) {
            console.warn(`Could not read document attachment ${doc.filename}:`, readErr.message);
          }
        }

        // 3. Process Audio & Video Attachments (Metadata Context)
        const mediaAttachments = attachments.filter(
          (a) => a.mime_type?.startsWith('audio/') || a.mime_type?.startsWith('video/')
        );
        for (const media of mediaAttachments) {
          const sizeKb = Math.round((media.file_size || 0) / 1024);
          formatted.content += `\n\n[Attached Media: "${media.original_name}" (${media.mime_type}, ${sizeKb} KB)]`;
        }
      }

      formattedMessages.push(formatted);
    }

    // 2. Select targeted tools (0 tools for normal chats, max 3 for action queries)
    const lastUserPrompt = messages[messages.length - 1]?.content || '';
    const targetedTools = await this._selectTargetedTools(lastUserPrompt, hasImages);

    const payload = {
      model: selectedModel,
      messages: formattedMessages,
      stream: Boolean(stream),
      keep_alive: '24h',
      options: {
        num_thread: 6,       // 6 threads to avoid CPU contention on 8 vCPUs
        num_ctx: 2048,       // Fast memory context
        num_predict: 512,    // Stop endless rambling, fast 5-10s answers
        temperature: 0.6
      }
    };

    // Include ONLY the 1-3 relevant tools if an operational action was explicitly requested
    if (targetedTools && targetedTools.length > 0) {
      payload.tools = targetedTools;
    }

    console.log(`[LATENCY TRACE] Step 1: Dispatching to Ollama (Model: ${selectedModel}, Tools: ${targetedTools.length}, Images: ${hasImages})`);
    const fetchStart = performance.now();
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

    const ttfbMs = Math.round(performance.now() - fetchStart);
    console.log(`[LATENCY TRACE] Step 2: HTTP headers received from Ollama in ${ttfbMs}ms (Status: ${response.status})`);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama API error (${response.status}): ${errText || response.statusText}`);
    }

    // 3. Process Stream or JSON Response
    if (stream && onChunk) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let buffer = '';
      let detectedToolCalls = [];
      let firstChunkLogged = false;

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

              // Check for native Ollama tool_calls
              if (parsed.message?.tool_calls && parsed.message.tool_calls.length > 0) {
                detectedToolCalls.push(...parsed.message.tool_calls);
              }

              if (parsed.message?.content) {
                if (!firstChunkLogged) {
                  firstChunkLogged = true;
                  console.log(`[LATENCY TRACE] Step 3: First text token generated by model in ${Math.round(performance.now() - fetchStart)}ms`);
                }
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

      // If tool calls were returned by Ollama, execute them
      if (detectedToolCalls.length > 0) {
        for (const tc of detectedToolCalls) {
          const toolName = tc.function?.name;
          const args = typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : (tc.function?.arguments || {});

          const toolResult = await ToolRegistry.execute(toolName, args);
          const cardPayload = `\n\n:::action_card\n${JSON.stringify({
            type: toolResult.approvalRequired ? 'approval_required' : 'action_executed',
            ...toolResult
          }, null, 2)}\n:::\n\n`;

          fullContent += cardPayload;
          onChunk(cardPayload);
        }
      }

      console.log(`[LATENCY TRACE] Step 4: Stream finished in ${Math.round(performance.now() - fetchStart)}ms (Length: ${fullContent.length} chars)`);

      return {
        content: fullContent,
        model: selectedModel
      };
    } else {
      const data = await response.json();
      let content = data.message?.content || '';

      // Check tool calls
      if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
        for (const tc of data.message.tool_calls) {
          const toolName = tc.function?.name;
          const args = typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : (tc.function?.arguments || {});

          const toolResult = await ToolRegistry.execute(toolName, args);
          content += `\n\n:::action_card\n${JSON.stringify({
            type: toolResult.approvalRequired ? 'approval_required' : 'action_executed',
            ...toolResult
          }, null, 2)}\n:::\n\n`;
        }
      }

      return {
        content,
        model: selectedModel,
        tokensUsed: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      };
    }
  }
}
