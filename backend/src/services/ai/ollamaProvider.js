import { AiProviderInterface } from './aiProviderInterface.js';
import fs from 'fs/promises';
import { concurrencyQueue } from '../queue/concurrencyQueue.js';
import { ToolRegistry } from '../tools/toolRegistry.js';
import { TavilyService } from '../search/tavilyService.js';

export class OllamaProvider extends AiProviderInterface {
  constructor(config) {
    super('ollama');
    this.baseUrl = (config.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.defaultModel = config.ollamaDefaultModel || 'gemma3:4b';
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

      const modelMeta = {
        'gemma3:4b': {
          displayName: 'Gemma 3 (4B) 🌟 [Default - High Performance]',
          description: 'Google Gemma 3 - Deep reasoning, rich formatting & high quality',
          priority: 1
        },
        'qwen2.5:3b': {
          displayName: 'Qwen 2.5 (3B) ⚡ [Fast]',
          description: 'Instant replies, direct full-depth answers without delays',
          priority: 2
        },
        'qwen2.5:1.5b': {
          displayName: 'Qwen 2.5 (1.5B) 🚀 [Ultra Fast]',
          description: 'Blazing fast 1-second response time on CPU',
          priority: 3
        },
        'qwen3:1.7b': {
          displayName: 'Qwen 3 (1.7B) 💡 [Fast Reasoning]',
          description: 'Lightweight reasoning & logic model',
          priority: 4
        },
        'qwen3:4b': {
          displayName: 'Qwen 3 (4B) 🧠 [Deep Reasoning]',
          description: 'Heavy 4B model (complex logic)',
          priority: 5
        },
        'qwen2.5vl:3b': {
          displayName: 'Qwen 2.5-VL (3B) 👁️ [Vision & OCR]',
          description: 'Multimodal image analysis and document reading',
          priority: 6
        }
      };

      const models = (data.models || [])
        .map((m) => {
          const meta = modelMeta[m.name] || {};
          return {
            id: m.name,
            name: meta.displayName || m.name,
            description: meta.description || `${Math.round(((m.size || 0) / 1024 / 1024 / 1024) * 10) / 10} GB Local Model`,
            tag: `${Math.round(((m.size || 0) / 1024 / 1024 / 1024) * 10) / 10}GB`,
            priority: meta.priority ?? 99
          };
        })
        .sort((a, b) => a.priority - b.priority);

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

  async generateResponse({ model, messages, attachments = [], userMemories = [], webSearch = false, stream = false, onChunk, signal }) {
    let selectedModel = model || this.defaultModel;

    // Gracefully map placeholder/mock IDs to the real default model configured on the server
    if (typeof selectedModel === 'string' && selectedModel.startsWith('kiaan-')) {
      selectedModel = this.defaultModel;
    }

    // Wrap execution inside the concurrency governor queue (Rate Limiter without prompt caching)
    return concurrencyQueue.enqueue(
      async () => {
        return this._executeOllamaInference({
          selectedModel,
          messages,
          attachments,
          userMemories,
          webSearch,
          stream,
          onChunk,
          signal
        });
      },
      { signal }
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
      project: ['task', 'milestone', 'sprint', 'roadmap', 'jira', 'assignee', 'blocker'],
      support: ['ticket', 'zendesk', 'escalate', 'complaint', 'customer issue'],
      analytics: ['metric', 'analytics', 'funnel', 'conversion', 'churn', 'kpi'],
      marketing: ['campaign', 'newsletter', 'seo', 'ad spend', 'ctr'],
      documents: ['document', 'pdf', 'contract', 'nda', 'signable', 'agreement']
    };

    let matchedDomain = null;
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        matchedDomain = domain;
        break;
      }
    }

    if (!matchedDomain) {
      return [];
    }

    try {
      const availableTools = await ToolRegistry.getToolsForAi(matchedDomain);
      return availableTools.slice(0, 3).map((t) => ({
        type: 'function',
        function: {
          name: t.function?.name || t.name,
          description: t.function?.description || t.description,
          parameters: t.function?.parameters || t.parameters
        }
      }));
    } catch {
      return [];
    }
  }

  async _executeOllamaInference({ selectedModel, messages, attachments = [], userMemories = [], webSearch = false, stream, onChunk, signal }) {
    // 1. Format messages for Ollama API
    const formattedMessages = [];
    const lastUserPrompt = messages[messages.length - 1]?.content || '';

    // System instruction: Crisp, fast, and structured like ChatGPT
    const systemPromptParts = [
      'You are Kiaan AI, an ultra-fast, highly capable, and intelligent developer workspace assistant.',
      '- For greetings, casual questions, and quick greetings: Be warm, friendly, concise, and direct.',
      '- For complex topics, coding requests, explanations, and creative writing: Provide thorough, comprehensive, well-structured answers with clear explanations and complete code blocks.',
      '- Format your responses cleanly using standard Markdown (headings, lists, bold text, and fenced code blocks with language tags) when appropriate.',
      'Never fabricate unrelated coding examples or long scenarios unless the user explicitly asks for them.'
    ];

    if (userMemories && userMemories.length > 0) {
      const memoryPrompt = userMemories
        .map((m) => `- ${m.key_name}: ${m.value_text}`)
        .join('\n');
      systemPromptParts.push(`Relevant user context:\n${memoryPrompt}`);
    }

    // Live Web Search Augmented Generation (via Tavily)
    if (TavilyService.isAvailable() && TavilyService.shouldSearch(lastUserPrompt, webSearch)) {
      try {
        const searchStart = performance.now();
        const searchResults = await TavilyService.search(lastUserPrompt, { maxResults: 3, signal });
        if (searchResults && searchResults.results.length > 0) {
          const searchContext = TavilyService.formatForPrompt(searchResults);
          systemPromptParts.push(searchContext);
          console.log(`[LATENCY TRACE] Tavily Web Search integrated in ${Math.round(performance.now() - searchStart)}ms (${searchResults.results.length} sources)`);
        }
      } catch (searchErr) {
        console.warn('[OllamaProvider] Tavily web search skipped:', searchErr.message);
      }
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
          : (msg.content || '')
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
            if (!selectedModel.includes('vl') && !selectedModel.includes('vision') && !selectedModel.includes('llava')) {
              selectedModel = process.env.OLLAMA_VISION_MODEL || 'qwen2.5vl:3b';
            }
          }
        }

        // 2. Process Text/Document Attachments (Extract Content into Context)
        const textAttachments = attachments.filter(
          (a) =>
            a.mime_type?.startsWith('text/') ||
            a.mime_type === 'application/json' ||
            a.original_name?.endsWith('.md') ||
            a.original_name?.endsWith('.txt') ||
            a.original_name?.endsWith('.csv')
        );
        for (const doc of textAttachments) {
          try {
            const docContent = await fs.readFile(doc.storage_path, 'utf8');
            const truncated = docContent.slice(0, 15000);
            formatted.content += `\n\n--- [Attached File Content: "${doc.original_name}"] ---\n${truncated}\n--- [End of File] ---`;
          } catch (readDocErr) {
            console.warn(`Could not read text attachment ${doc.filename}:`, readDocErr.message);
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
    const targetedTools = await this._selectTargetedTools(lastUserPrompt, hasImages);

    // Context size: Default to 2048 to prevent OOM crash on VPS, can be overridden via OLLAMA_NUM_CTX
    const numCtx = parseInt(process.env.OLLAMA_NUM_CTX, 10) || 2048;
    const numPredict = parseInt(process.env.OLLAMA_NUM_PREDICT, 10) || 2048;

    const payload = {
      model: selectedModel,
      messages: formattedMessages,
      stream: Boolean(stream),
      keep_alive: '24h',
      options: {
        num_ctx: numCtx,
        num_predict: numPredict,
        temperature: 0.7,
        top_k: 40,
        top_p: 0.9
      }
    };

    if (targetedTools && targetedTools.length > 0) {
      payload.tools = targetedTools;
    }

    console.log(`[LATENCY TRACE] Step 1: Dispatching to Ollama (Model: ${selectedModel}, Tools: ${targetedTools.length}, Images: ${hasImages}, Context: ${numCtx})`);
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
      const cause = networkErr.cause?.code || networkErr.cause?.message || networkErr.message || 'Connection failed';
      console.error(`[Ollama Generation Error] ${networkErr.message} (Cause: ${cause}) at ${this.baseUrl}`);
      throw new Error(
        `Ollama generation failed: unable to connect to Ollama at ${this.baseUrl} (${cause}). Verify that Ollama is running on the server and bound to 0.0.0.0:11434.`
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
      let thinkBuffer = '';
      let thinkEmitted = false;

      const abortHandler = () => {
        try {
          reader.cancel();
        } catch {}
      };

      if (signal) {
        if (signal.aborted) {
          abortHandler();
          throw new Error('Generation was cancelled by user.');
        }
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      try {
        while (true) {
          if (signal?.aborted) {
            abortHandler();
            throw new Error('Generation was cancelled by user.');
          }

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

              if (parsed.message?.tool_calls && parsed.message.tool_calls.length > 0) {
                detectedToolCalls.push(...parsed.message.tool_calls);
              }

              // Capture thinking trace if model separates it
              if (parsed.message?.thinking) {
                thinkBuffer += parsed.message.thinking;
              }

              if (parsed.message?.content) {
                if (thinkBuffer && !thinkEmitted) {
                  const thinkBlock = `<think>\n${thinkBuffer.trim()}\n</think>\n\n`;
                  thinkEmitted = true;
                  fullContent += thinkBlock;
                  onChunk(thinkBlock);
                }

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
        if (streamErr.name === 'AbortError' || signal?.aborted) {
          throw new Error('Generation was cancelled by user.');
        }
        throw streamErr;
      } finally {
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
      }

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

      if (data.message?.thinking) {
        content = `<think>\n${data.message.thinking.trim()}\n</think>\n\n${content}`;
      }

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
