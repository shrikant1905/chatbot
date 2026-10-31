import { AiProviderInterface } from './aiProviderInterface.js';
import fs from 'fs/promises';
import http from 'http';
import https from 'https';
import { concurrencyQueue } from '../queue/concurrencyQueue.js';
import { ToolRegistry } from '../tools/toolRegistry.js';
import { TavilyService } from '../search/tavilyService.js';

export class OllamaProvider extends AiProviderInterface {
  constructor(config) {
    super('ollama');
    this.baseUrl = (config.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.defaultModel = config.ollamaDefaultModel || 'gemma3:4b';

    // Warm-up ping to keep default model pre-loaded in VPS RAM (Zero Cold-Start Lag)
    this._warmupDefaultModel();
  }

  /**
   * Non-blocking background warm-up of default model into RAM
   */
  _warmupDefaultModel() {
    setTimeout(async () => {
      try {
        await this._ensureDedicatedRam(this.defaultModel);
        fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.defaultModel,
            prompt: 'hi',
            stream: false,
            keep_alive: '24h',
            options: { num_predict: 1, num_thread: 8 }
          })
        }).catch(() => {});
      } catch {}
    }, 1500);
  }

  /**
   * Automatic RAM Hygiene: Ensures only ONE model is active in VPS RAM at any time.
   * If any other model is lingering in RAM, unloads it immediately to prevent Linux swap thrashing.
   */
  async _ensureDedicatedRam(targetModel) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.baseUrl}/api/ps`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return;

      const data = await res.json();
      const runningModels = data.models || [];
      for (const m of runningModels) {
        const mName = m.name || m.model || '';
        if (mName && mName !== targetModel) {
          console.log(`[RAM HYGIENE] Unloading inactive model ${mName} to give 100% RAM to ${targetModel}...`);
          fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: mName, keep_alive: 0 })
          }).catch(() => {});
        }
      }
    } catch {
      // Non-blocking
    }
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
        'qwen3:1.7b': {
          displayName: 'Qwen 3 (1.7B) ⚡ [Lightning Fast - 7 tok/s]',
          description: 'Ultra-fast lightweight reasoning model on VPS CPU',
          priority: 2
        },
        'qwen2.5:3b': {
          displayName: 'Qwen 2.5 (3B) 🚀 [Fast Conversational]',
          description: 'Instant replies, direct full-depth answers without delays',
          priority: 3
        },
        'qwen2.5-coder:3b': {
          displayName: 'Qwen 2.5 Coder (3B) 💻 [Code Specialist]',
          description: 'Optimized for syntax, debugging, and software architecture',
          priority: 4
        },
        'qwen2.5vl:3b': {
          displayName: 'Qwen 2.5-VL (3B) 👁️ [Vision & OCR]',
          description: 'Multimodal image analysis and document reading',
          priority: 5
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

    // Wrap execution inside concurrency queue
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

  /**
   * Native HTTP/HTTPS Request Dispatcher.
   * Eliminates Node fetch UND_ERR_HEADERS_TIMEOUT by setting timeout: 0
   * and streaming chunks directly from the TCP socket.
   */
  _dispatchOllamaHttp({ payload, stream, onChunk, signal }) {
    return new Promise((resolve, reject) => {
      const isHttps = this.baseUrl.startsWith('https://');
      const httpModule = isHttps ? https : http;
      const url = new URL(`${this.baseUrl}/api/chat`);
      const postData = JSON.stringify(payload);

      let settled = false;
      let req = null;

      const cleanup = () => {
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
      };

      const abortHandler = () => {
        if (!settled) {
          settled = true;
          cleanup();
          if (req) {
            try {
              req.destroy();
            } catch {}
          }
          reject(new Error('Generation was cancelled by user.'));
        }
      };

      if (signal) {
        if (signal.aborted) {
          return reject(new Error('Generation was cancelled by user.'));
        }
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      req = httpModule.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 0 // No socket or header timeout!
        },
        (res) => {
          if (res.statusCode !== 200) {
            let errBody = '';
            res.on('data', (c) => (errBody += c));
            res.on('end', () => {
              settled = true;
              cleanup();
              reject(new Error(`Ollama API error (${res.statusCode}): ${errBody || res.statusMessage}`));
            });
            return;
          }

          res.setEncoding('utf8');
          let buffer = '';
          let fullContent = '';
          let detectedToolCalls = [];
          let thinkBuffer = '';
          let thinkEmitted = false;
          let firstChunkLogged = false;

          res.on('data', (chunk) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Retain incomplete line in buffer

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const parsed = JSON.parse(trimmed);

                // 1. Capture tool calls if returned
                if (parsed.message?.tool_calls && Array.isArray(parsed.message.tool_calls)) {
                  detectedToolCalls.push(...parsed.message.tool_calls);
                }

                // 2. Capture thinking tokens
                if (parsed.message?.thinking) {
                  thinkBuffer += parsed.message.thinking;
                }

                // 3. Process text tokens
                const delta = parsed.message?.content || parsed.response || '';
                if (delta) {
                  fullContent += delta;

                  if (stream && onChunk) {
                    // Filter <think> blocks in real-time streaming
                    if (delta.includes('<think>')) {
                      thinkEmitted = true;
                      thinkBuffer += delta;
                      continue;
                    }

                    if (thinkEmitted) {
                      thinkBuffer += delta;
                      if (thinkBuffer.includes('</think>')) {
                        const parts = thinkBuffer.split('</think>');
                        thinkEmitted = false;
                        thinkBuffer = '';
                        if (parts[1]) {
                          onChunk(parts[1]);
                        }
                      }
                      continue;
                    }

                    if (!firstChunkLogged) {
                      firstChunkLogged = true;
                    }
                    onChunk(delta);
                  }
                }
              } catch {
                // Ignore partial JSON parsing
              }
            }
          });

          res.on('end', () => {
            if (!settled) {
              settled = true;
              cleanup();
              resolve({
                content: fullContent,
                detectedToolCalls
              });
            }
          });

          res.on('error', (resErr) => {
            if (!settled) {
              settled = true;
              cleanup();
              reject(resErr);
            }
          });
        }
      );

      req.on('error', (netErr) => {
        if (!settled) {
          settled = true;
          cleanup();
          const cause = netErr.code || netErr.message || 'Connection failed';
          reject(
            new Error(
              `Ollama generation failed: unable to connect to Ollama at ${this.baseUrl} (${cause}). Verify that Ollama is running on the server and bound to 0.0.0.0:11434.`
            )
          );
        }
      });

      req.write(postData);
      req.end();
    });
  }

  async _executeOllamaInference({ selectedModel, messages, attachments = [], userMemories = [], webSearch = false, stream, onChunk, signal }) {
    // 0. Dedicated Model Enforcement: Unload any other models currently occupying RAM to avoid swap thrashing
    await this._ensureDedicatedRam(selectedModel);

    // 1. Dynamic Query Classification for Instant Latency
    const lastUserPrompt = messages[messages.length - 1]?.content || '';
    const trimmedPrompt = lastUserPrompt.trim().toLowerCase();

    const isGreetingOrCasual =
      /^(hi|hello|hey|greetings|howdy|good\s+(morning|afternoon|evening|night)|how are you|kya haal|kaise ho|namaste|who are you|what is your name)[.?!,\s]*$/i.test(trimmedPrompt) ||
      (trimmedPrompt.length < 35 && !/[{}<>()=;]/.test(trimmedPrompt) && !/explain|create|write|implement|build|code|design|solve/i.test(trimmedPrompt));

    const isDateTime =
      /\b(today('?s)?\s*(date|day|time|clock)|current\s*(time|date|day|clock)|what\s*(time|date|day)\s*is\s*it|which\s*(date|day)\s*is\s*(today|it))\b/i.test(trimmedPrompt);

    const isQuickQuery = (isGreetingOrCasual || isDateTime) && attachments.length === 0;

    // Real-Time System Clock (Accurate 0ms Answer for Date/Time Queries)
    const now = new Date();
    const currentClockStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) + ', ' + now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const formattedMessages = [];
    const systemPromptParts = [];

    if (isQuickQuery) {
      // Ultra-Fast Compact Prompt (~25 tokens) for instantaneous prompt evaluation (<1.2s)
      systemPromptParts.push(
        `You are Kiaan AI, an ultra-fast, intelligent developer workspace assistant. Current Real-Time System Clock: ${currentClockStr} (Year: 2026). Answer concisely, directly, and warmly without preamble.`
      );
    } else {
      // Rich Comprehensive Prompt for complex logic, programming, creative work
      systemPromptParts.push(
        'You are Kiaan AI, an ultra-fast, highly capable, and intelligent developer workspace assistant.',
        `Current Real-Time System Clock: ${currentClockStr} (Year: 2026). If the user asks about today's date, day, time, or year, state it directly and concisely from this real-time system clock without needing web search.`,
        '- For greetings and casual queries: Be warm, friendly, concise, and direct.',
        '- For coding, technical topics, and explanations: Provide thorough, structured answers with complete code blocks and language tags.',
        '- Format cleanly with standard Markdown (headings, lists, bold text, code blocks).'
      );
    }

    if (userMemories && userMemories.length > 0 && !isQuickQuery) {
      const memoryPrompt = userMemories
        .slice(0, 5)
        .map((m) => `- ${m.key_name}: ${m.value_text}`)
        .join('\n');
      systemPromptParts.push(`Relevant user context:\n${memoryPrompt}`);
    }

    // Live Web Search Augmented Generation (via Tavily)
    let isWebSearchApplied = false;
    if (TavilyService.isAvailable() && TavilyService.shouldSearch(lastUserPrompt, webSearch)) {
      try {
        const searchStart = performance.now();
        const searchResults = await TavilyService.search(lastUserPrompt, { maxResults: 3, signal });
        if (searchResults && searchResults.results.length > 0) {
          const searchContext = TavilyService.formatForPrompt(searchResults);
          systemPromptParts.push(searchContext);
          isWebSearchApplied = true;
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

    // Dynamic history window: Quick queries only need 2 messages (1 turn) for instant prompt eval!
    // Search queries use 4 messages, technical queries use up to 6 messages.
    const historySliceLimit = isQuickQuery ? 2 : isWebSearchApplied ? 4 : 6;
    const historyToProcess = messages.slice(-historySliceLimit);

    let hasImages = false;

    for (let i = 0; i < historyToProcess.length; i++) {
      const msg = historyToProcess[i];
      const isLastMessage = i === historyToProcess.length - 1;

      let msgContent = msg.content || '';
      // Truncate previous assistant turns to save CPU context evaluation time
      if (msg.role === 'assistant' && !isLastMessage) {
        msgContent = msgContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (msgContent.length > 250) {
          msgContent = msgContent.slice(0, 250) + '...';
        }
      }

      const formatted = {
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msgContent
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

        // 2. Process Text/Document Attachments
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
            const truncated = docContent.slice(0, 8000);
            formatted.content += `\n\n--- [Attached File Content: "${doc.original_name}"] ---\n${truncated}\n--- [End of File] ---`;
          } catch (readDocErr) {
            console.warn(`Could not read text attachment ${doc.filename}:`, readDocErr.message);
          }
        }

        // 3. Process Media Attachments
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

    // Optimized dynamic parameters for fast CPU response on VPS
    const numCtx = isQuickQuery ? 512 : isWebSearchApplied ? 768 : (parseInt(process.env.OLLAMA_NUM_CTX, 10) || 1024);
    const numPredict = isQuickQuery ? 128 : isWebSearchApplied ? 256 : (parseInt(process.env.OLLAMA_NUM_PREDICT, 10) || 512);
    const numThread = parseInt(process.env.OLLAMA_NUM_THREAD, 10) || 8;

    const payload = {
      model: selectedModel,
      messages: formattedMessages,
      stream: Boolean(stream),
      keep_alive: '24h',
      options: {
        num_ctx: numCtx,
        num_predict: numPredict,
        num_thread: numThread,
        temperature: 0.7,
        top_k: 40,
        top_p: 0.9
      }
    };

    if (targetedTools && targetedTools.length > 0) {
      payload.tools = targetedTools;
    }

    console.log(`[LATENCY TRACE] Step 1: Dispatching to Ollama (Model: ${selectedModel}, Tools: ${targetedTools.length}, Images: ${hasImages}, Context: ${numCtx}, Threads: ${numThread})`);
    const fetchStart = performance.now();

    // Dispatch via Native HTTP streaming (Zero Headers Timeout)
    const result = await this._dispatchOllamaHttp({
      payload,
      stream,
      onChunk,
      signal
    });

    let fullContent = result.content;
    const detectedToolCalls = result.detectedToolCalls || [];

    // Execute detected tool calls if any
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
        if (onChunk) {
          onChunk(cardPayload);
        }
      }
    }

    console.log(`[LATENCY TRACE] Step 4: Stream finished in ${Math.round(performance.now() - fetchStart)}ms (Length: ${fullContent.length} chars)`);

    return {
      content: fullContent,
      model: selectedModel
    };
  }
}
