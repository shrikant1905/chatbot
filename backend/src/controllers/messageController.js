import crypto from 'crypto';
import { MessageService } from '../services/messageService.js';
import { ConversationService } from '../services/conversationService.js';
import { AttachmentService } from '../services/attachmentService.js';
import { MemoryService } from '../services/memoryService.js';
import { getAiProvider, resolveAiProvider } from '../services/ai/index.js';
import { getPool } from '../db/pool.js';
import { isBullMQActive, enqueueAiJob, AiStreamBridge } from '../services/queue/index.js';

/**
 * Dispatches AI generation.
 * For high-concurrency cloud models (Grok, OpenAI, Gemini), requests are executed directly
 * in parallel using asynchronous non-blocking I/O.
 * 100+ concurrent users can all stream simultaneously without waiting in line!
 */
async function dispatchAiGeneration({
  jobId,
  conversationId,
  userId,
  model,
  messages,
  attachments,
  userMemories,
  webSearch,
  stream,
  onChunk,
  signal
}) {
  const aiProvider = resolveAiProvider(model);

  // If BullMQ + Redis is active AND model is local Ollama, queue through BullMQ
  if (isBullMQActive() && aiProvider.name === 'ollama') {
    try {
      const streamPromise = new Promise((resolve, reject) => {
        AiStreamBridge.subscribe(jobId, {
          onChunk,
          onDone: resolve,
          onError: reject
        }).catch(reject);
      });

      await enqueueAiJob({
        jobId,
        conversationId,
        userId,
        model,
        messages,
        attachments,
        userMemories,
        webSearch,
        stream
      });

      return await streamPromise;
    } catch (queueErr) {
      console.warn(`[BullMQ Dispatch] Enqueue error, falling back to direct inference:`, queueErr.message);
    }
  }

  // HIGH-CONCURRENCY PARALLEL EXECUTION:
  // Each user gets their own streaming HTTP request in parallel.
  return aiProvider.generateResponse({
    model,
    messages,
    attachments,
    userMemories,
    webSearch,
    stream,
    onChunk,
    signal
  });
}

export class MessageController {
  static async sendMessage(req, res, next) {
    const { conversationId } = req.params;
    const { content, model, stream = false, attachmentIds = [], webSearch = false, history = [] } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    const isGuest = Boolean(req.user?.isGuest);
    const pool = getPool();

    try {
      let userMessage = null;
      let contextMessages = [];
      let userMemories = [];
      let attachmentsData = [];

      if (!isGuest) {
        // 1. Authenticated User: Verify or auto-create conversation in MySQL
        let [convRows] = await pool.query(
          'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
          [conversationId, req.user.id]
        );

        let isFirstMessage = false;
        if (convRows.length === 0) {
          const titleSnippet = content.trim().slice(0, 36) + (content.trim().length > 36 ? '...' : '');
          await ConversationService.createConversation({
            id: conversationId,
            userId: req.user.id,
            title: titleSnippet,
            model: model || 'grok-4.20-0309-non-reasoning'
          });
          isFirstMessage = true;
        } else {
          const [existingMsgCount] = await pool.query(
            'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
            [conversationId]
          );
          isFirstMessage = existingMsgCount[0].count === 0;
          if (isFirstMessage) {
            const titleSnippet = content.trim().slice(0, 36) + (content.trim().length > 36 ? '...' : '');
            await pool.query('UPDATE conversations SET title = ? WHERE id = ?', [titleSnippet, conversationId]);
          }
        }

        // 2. Save user message to database
        userMessage = await MessageService.saveUserMessage({
          conversationId,
          content: content.trim(),
          model: model || null
        });

        // 3. Link attachments if any
        if (attachmentIds && attachmentIds.length > 0) {
          await AttachmentService.linkAttachmentsToMessage(attachmentIds, userMessage.id);
          const placeholders = attachmentIds.map(() => '?').join(',');
          const [attRows] = await pool.query(
            `SELECT * FROM attachments WHERE id IN (${placeholders})`,
            attachmentIds
          );
          attachmentsData = attRows;
        }

        // 4. Build bounded context window and memories from DB
        contextMessages = await MessageService.buildConversationContext(conversationId, 6);
        userMemories = await MemoryService.getMemories(req.user.id);
      } else {
        // GUEST MODE: Pure in-memory! No saving to MySQL tables!
        userMessage = {
          id: `guest_msg_${Date.now()}`,
          conversation_id: conversationId,
          role: 'user',
          content: content.trim(),
          created_at: new Date().toISOString(),
          isGuest: true
        };

        // Context from current session history (passed from client) or current prompt
        if (Array.isArray(history) && history.length > 0) {
          contextMessages = history.slice(-6).map((m) => ({
            role: m.role || 'user',
            content: m.content || ''
          }));
        } else {
          contextMessages = [{ role: 'user', content: content.trim() }];
        }
      }

      // 5. Generate unique Job ID and setup abort handler
      const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const abortController = new AbortController();

      req.on('close', () => {
        if (!res.writableEnded) {
          abortController.abort();
          if (isBullMQActive()) {
            AiStreamBridge.publishAbort(jobId);
          }
        }
      });

      // Handle streaming SSE
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        // Send user message event
        res.write(`event: user_message\ndata: ${JSON.stringify(userMessage)}\n\n`);

        let accumulatedContent = '';

        try {
          const aiResult = await dispatchAiGeneration({
            jobId,
            conversationId,
            userId: req.user.id,
            model: model || 'grok-4.20-0309-non-reasoning',
            messages: contextMessages,
            attachments: attachmentsData,
            userMemories,
            webSearch: Boolean(webSearch),
            stream: true,
            onChunk: (chunk) => {
              accumulatedContent += chunk;
              res.write(`event: chunk\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
            },
            signal: abortController.signal
          });

          // Save completed assistant message (only if NOT guest)
          let assistantMessage = null;
          if (!isGuest) {
            assistantMessage = await MessageService.saveAssistantMessage({
              conversationId,
              content: accumulatedContent || aiResult.content,
              status: 'completed',
              model: aiResult.model || model,
              tokensUsed: aiResult.tokensUsed || 0
            });
          } else {
            assistantMessage = {
              id: `guest_assist_${Date.now()}`,
              conversation_id: conversationId,
              role: 'assistant',
              content: accumulatedContent || aiResult.content,
              status: 'completed',
              model: aiResult.model || model,
              created_at: new Date().toISOString(),
              isGuest: true
            };
          }

          res.write(`event: done\ndata: ${JSON.stringify({ message: assistantMessage })}\n\n`);
          res.end();
        } catch (genErr) {
          console.error('[AI Generation Error]', genErr.message);

          if (!isGuest && abortController.signal.aborted) {
            await pool.query('UPDATE messages SET status = ? WHERE id = ?', ['cancelled', userMessage.id]);
          }

          let failedMessage = null;
          if (!isGuest) {
            failedMessage = await MessageService.saveAssistantMessage({
              conversationId,
              content: abortController.signal.aborted ? 'Generation was stopped by user.' : `Error: ${genErr.message}`,
              status: abortController.signal.aborted ? 'cancelled' : 'failed',
              model: model || 'grok-4.20-0309-non-reasoning'
            });
          } else {
            failedMessage = {
              id: `guest_failed_${Date.now()}`,
              conversation_id: conversationId,
              role: 'assistant',
              content: abortController.signal.aborted ? 'Generation was stopped by user.' : `Error: ${genErr.message}`,
              status: abortController.signal.aborted ? 'cancelled' : 'failed',
              model: model || 'grok-4.20-0309-non-reasoning',
              isGuest: true
            };
          }

          res.write(
            `event: error\ndata: ${JSON.stringify({
              error: genErr.message,
              message: failedMessage
            })}\n\n`
          );
          res.end();
        }
      } else {
        // Non-streaming standard response
        try {
          const aiResult = await dispatchAiGeneration({
            jobId,
            conversationId,
            userId: req.user.id,
            model: model || 'grok-4.20-0309-non-reasoning',
            messages: contextMessages,
            attachments: attachmentsData,
            userMemories,
            webSearch: Boolean(webSearch),
            stream: false,
            signal: abortController.signal
          });

          let assistantMessage = null;
          if (!isGuest) {
            assistantMessage = await MessageService.saveAssistantMessage({
              conversationId,
              content: aiResult.content,
              status: 'completed',
              model: aiResult.model || model,
              tokensUsed: aiResult.tokensUsed || 0
            });
          } else {
            assistantMessage = {
              id: `guest_assist_${Date.now()}`,
              conversation_id: conversationId,
              role: 'assistant',
              content: aiResult.content,
              status: 'completed',
              model: aiResult.model || model,
              created_at: new Date().toISOString(),
              isGuest: true
            };
          }

          res.status(201).json({
            success: true,
            userMessage,
            assistantMessage
          });
        } catch (genErr) {
          console.error('[AI Generation Error]', genErr.message);
          res.status(502).json({
            success: false,
            error: genErr.message,
            userMessage
          });
        }
      }
    } catch (err) {
      next(err);
    }
  }

  static async listMessages(req, res, next) {
    try {
      if (req.user?.isGuest) {
        return res.json({ success: true, messages: [] });
      }
      const { conversationId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const messages = await MessageService.listMessages(conversationId, { limit, offset });
      res.json({ success: true, messages });
    } catch (err) {
      next(err);
    }
  }

  static async regenerateMessage(req, res, next) {
    const { conversationId } = req.params;
    const { model, history = [] } = req.body;
    const isGuest = Boolean(req.user?.isGuest);

    try {
      const pool = getPool();
      let contextMessages = [];

      if (!isGuest) {
        const [userMsgRows] = await pool.query(
          "SELECT * FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1",
          [conversationId]
        );

        if (userMsgRows.length === 0) {
          return res.status(400).json({ success: false, error: 'No previous user message to regenerate' });
        }

        contextMessages = await MessageService.buildConversationContext(conversationId, 10);
      } else {
        if (Array.isArray(history) && history.length > 0) {
          contextMessages = history.slice(-6).map((m) => ({
            role: m.role || 'user',
            content: m.content || ''
          }));
        } else {
          return res.status(400).json({ success: false, error: 'No previous user message to regenerate' });
        }
      }

      const userMemories = !isGuest ? await MemoryService.getMemories(req.user.id) : [];
      const jobId = `regen_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const aiResult = await dispatchAiGeneration({
        jobId,
        conversationId,
        userId: req.user.id,
        model: model || 'grok-4.20-0309-non-reasoning',
        messages: contextMessages,
        attachments: [],
        userMemories,
        webSearch: false,
        stream: false
      });

      let assistantMessage = null;
      if (!isGuest) {
        assistantMessage = await MessageService.saveAssistantMessage({
          conversationId,
          content: aiResult.content,
          status: 'completed',
          model: aiResult.model || model,
          tokensUsed: aiResult.tokensUsed || 0
        });
      } else {
        assistantMessage = {
          id: `guest_regen_${Date.now()}`,
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResult.content,
          status: 'completed',
          model: aiResult.model || model,
          created_at: new Date().toISOString(),
          isGuest: true
        };
      }

      res.json({
        success: true,
        assistantMessage
      });
    } catch (err) {
      next(err);
    }
  }
}
