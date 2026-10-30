import { AiProviderInterface } from './aiProviderInterface.js';
import fs from 'fs/promises';
import { concurrencyQueue } from '../queue/concurrencyQueue.js';
import { ToolRegistry } from '../tools/toolRegistry.js';

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

  async generateResponse({ model, messages, attachments = [], userMemories = [], stream = false, onChunk, signal }) {
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
      'You are Kiaan AI, an ultra-fast, helpful, highly capable, and intelligent assistant designed like ChatGPT.',
      'Always provide complete, in-depth, rich, and full-length responses. Never cut answers short, never summarize prematurely, and never omit important details.',
      'Format your responses cleanly and beautifully using standard GitHub-flavored Markdown:',
      '- Use descriptive headings (## and ###) to structure the response clearly.',
      '- When writing code, provide complete, working, production-ready code with explanations in fenced code blocks with language identifiers (e.g. ```javascript, ```python, ```tsx, ```bash, etc.). Never truncate code blocks or leave unfinished placeholders.',
      '- When writing emails, letters, or templates, provide the complete, ready-to-use version with subject line, professional greeting, full in-depth body paragraphs, bullet points for key details, and a polished sign-off.',
      '- Use bullet points (* or -) and numbered lists (1. 2. 3.) for clarity and high readability.',
      '- Use Markdown tables (| col1 | col2 |) whenever comparing items or presenting structured data.',
      '- Explain concepts thoroughly with real-world examples, best practices, and actionable insights.',
      'Directly answer the user\'s latest message thoroughly and completely.'
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
        num_ctx: parseInt(process.env.OLLAMA_NUM_CTX, 10) || 4096,
        num_predict: parseInt(process.env.OLLAMA_NUM_PREDICT, 10) || 4096, // Full length responses!
        temperature: 0.7,
        top_k: 40,
        top_p: 0.9
      }
    };

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
