import crypto from 'crypto';
import { MessageService } from '../services/messageService.js';
import { ConversationService } from '../services/conversationService.js';
import { AttachmentService } from '../services/attachmentService.js';
import { MemoryService } from '../services/memoryService.js';
import { getAiProvider } from '../services/ai/index.js';
import { getPool } from '../db/pool.js';

export class MessageController {
  static async sendMessage(req, res, next) {
    const { conversationId } = req.params;
    const { content, model, stream = false, attachmentIds = [], webSearch = false } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    try {
      // 1. Verify or auto-create conversation
      const pool = getPool();
      let [convRows] = await pool.query(
        'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
        [conversationId, req.user.id]
      );

      let isFirstMessage = false;
      if (convRows.length === 0) {
        // Auto create conversation
        const titleSnippet = content.trim().slice(0, 36) + (content.trim().length > 36 ? '...' : '');
        await ConversationService.createConversation({
          id: conversationId,
          userId: req.user.id,
          title: titleSnippet,
          model: model || 'kiaan-ultra'
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
      const userMessage = await MessageService.saveUserMessage({
        conversationId,
        content: content.trim(),
        model: model || null
      });

      // 3. Link attachments if any
      if (attachmentIds && attachmentIds.length > 0) {
        await AttachmentService.linkAttachmentsToMessage(attachmentIds, userMessage.id);
      }

      // 4. Retrieve attachments metadata for context
      let attachmentsData = [];
      if (attachmentIds && attachmentIds.length > 0) {
        const placeholders = attachmentIds.map(() => '?').join(',');
        const [attRows] = await pool.query(
          `SELECT * FROM attachments WHERE id IN (${placeholders})`,
          attachmentIds
        );
        attachmentsData = attRows;
      }

      // 5. Build bounded context window and retrieve user memories
      const contextMessages = await MessageService.buildConversationContext(conversationId, 10);
      const userMemories = await MemoryService.getMemories(req.user.id);

      // 6. Get AI Provider
      const aiProvider = getAiProvider();
      const abortController = new AbortController();

      req.on('close', () => {
        if (!res.writableEnded) {
          abortController.abort();
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
          const aiResult = await aiProvider.generateResponse({
            model: model || 'kiaan-ultra',
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

          // Save completed assistant message
          const assistantMessage = await MessageService.saveAssistantMessage({
            conversationId,
            content: accumulatedContent || aiResult.content,
            status: 'completed',
            model: aiResult.model || model,
            tokensUsed: aiResult.tokensUsed || 0
          });

          res.write(`event: done\ndata: ${JSON.stringify({ message: assistantMessage })}\n\n`);
          res.end();
        } catch (genErr) {
          console.error('[AI Generation Error]', genErr.message);

          // Mark user message as cancelled if stopped
          if (abortController.signal.aborted) {
            await pool.query('UPDATE messages SET status = ? WHERE id = ?', ['cancelled', userMessage.id]);
          }

          // Save failed message state in DB
          const failedMessage = await MessageService.saveAssistantMessage({
            conversationId,
            content: abortController.signal.aborted ? 'Generation was stopped by user.' : `Error: ${genErr.message}`,
            status: abortController.signal.aborted ? 'cancelled' : 'failed',
            model: model || 'kiaan-ultra'
          });

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
          const aiResult = await aiProvider.generateResponse({
            model: model || 'kiaan-ultra',
            messages: contextMessages,
            attachments: attachmentsData,
            userMemories,
            webSearch: Boolean(webSearch),
            stream: false,
            signal: abortController.signal
          });

          const assistantMessage = await MessageService.saveAssistantMessage({
            conversationId,
            content: aiResult.content,
            status: 'completed',
            model: aiResult.model || model,
            tokensUsed: aiResult.tokensUsed || 0
          });

          res.json({
            success: true,
            userMessage,
            assistantMessage
          });
        } catch (genErr) {
          console.error('[AI Generation Error]', genErr.message);

          const failedMessage = await MessageService.saveAssistantMessage({
            conversationId,
            content: abortController.signal.aborted ? 'Generation was stopped by user.' : `Error: ${genErr.message}`,
            status: 'failed',
            model: model || 'kiaan-ultra'
          });

          return res.status(502).json({
            success: false,
            error: genErr.message,
            userMessage,
            assistantMessage: failedMessage
          });
        }
      }
    } catch (err) {
      next(err);
    }
  }

  static async listMessages(req, res, next) {
    try {
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
    const { model } = req.body;

    try {
      // Find the last user message
      const pool = getPool();
      const [userMsgRows] = await pool.query(
        "SELECT * FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1",
        [conversationId]
      );

      if (userMsgRows.length === 0) {
        return res.status(400).json({ success: false, error: 'No previous user message to regenerate' });
      }

      const contextMessages = await MessageService.buildConversationContext(conversationId, 10);
      const userMemories = await MemoryService.getMemories(req.user.id);
      const aiProvider = getAiProvider();

      const aiResult = await aiProvider.generateResponse({
        model: model || 'kiaan-ultra',
        messages: contextMessages,
        userMemories,
        webSearch: false,
        stream: false
      });

      const assistantMessage = await MessageService.saveAssistantMessage({
        conversationId,
        content: aiResult.content,
        status: 'completed',
        model: aiResult.model || model,
        tokensUsed: aiResult.tokensUsed || 0
      });

      res.json({
        success: true,
        assistantMessage
      });
    } catch (err) {
      next(err);
    }
  }
}
