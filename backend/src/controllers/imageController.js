import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateComfyUIImage, checkComfyUIHealth } from '../services/image/comfyUIService.js';
import { enqueueImageJob, inMemoryImageQueue, getOrCreateImageQueue } from '../services/queue/imageQueue.js';
import { MessageService } from '../services/messageService.js';
import { ConversationService } from '../services/conversationService.js';
import { config } from '../config/index.js';

export const ImageController = {
  /**
   * Health and Status endpoint for ComfyUI integration.
   * GET /api/images/health
   */
  async health(req, res) {
    try {
      const comfyHealth = await checkComfyUIHealth();
      return res.json({
        success: true,
        comfyUI: comfyHealth,
        config: {
          url: config.comfyUI?.baseUrl,
          defaultModel: config.comfyUI?.defaultModel,
          concurrency: config.comfyUI?.concurrency
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * Generate an image from a prompt.
   * POST /api/images/generate
   * Body: { prompt, negativePrompt, conversationId, width, height, steps, cfg }
   */
  async generateImage(req, res) {
    try {
      const { prompt, negativePrompt, conversationId, width, height, steps, cfg } = req.body;

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid image prompt.'
        });
      }

      const trimmedPrompt = prompt.trim();
      const userId = req.user?.id || 'default_user';

      // 1. Verify ComfyUI server is reachable before queuing
      const health = await checkComfyUIHealth();
      if (!health.healthy) {
        return res.status(503).json({
          success: false,
          error: `ComfyUI Stable Diffusion engine is offline or not reachable at ${config.comfyUI?.baseUrl || 'http://127.0.0.1:8188'}. Please ensure ComfyUI is running on the server.`
        });
      }

      // 2. Direct generation execution
      // We process the generation and deliver the high-res result
      const result = await generateComfyUIImage({
        prompt: trimmedPrompt,
        negativePrompt,
        width: width ? parseInt(width, 10) : 512,
        height: height ? parseInt(height, 10) : 512,
        steps: steps ? parseInt(steps, 10) : 20,
        cfg: cfg ? parseFloat(cfg) : 7.0
      });

      // 3. Persist to Conversation if conversationId is provided
      let savedMessage = null;
      if (conversationId) {
        try {
          const conversation = await ConversationService.getConversation(conversationId);
          if (conversation) {
            // Save Assistant Message containing the generated image
            savedMessage = await MessageService.saveAssistantMessage({
              conversationId,
              content: `Here is your generated image for: **"${trimmedPrompt}"**\n\n![Generated Image](${result.relativeUrl})`,
              model: `Stable Diffusion 1.5 (${config.comfyUI?.defaultModel || 'SD 1.5'})`
            });
          }
        } catch (dbErr) {
          console.warn('[ImageController] Could not persist image message to DB:', dbErr.message);
        }
      }

      return res.json({
        success: true,
        image: {
          url: result.relativeUrl,
          filename: result.filename,
          prompt: trimmedPrompt,
          promptId: result.promptId,
          sizeBytes: result.sizeBytes
        },
        message: savedMessage
      });
    } catch (err) {
      console.error('[ImageController Generate Error]:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Image generation failed.'
      });
    }
  },

  /**
   * Serve a generated image file.
   * GET /api/images/file/:filename
   */
  async serveFile(req, res) {
    try {
      const { filename } = req.params;
      // Prevent path traversal
      const safeFilename = path.basename(filename);
      const uploadsDir = path.resolve(config.upload?.dir || 'uploads', 'generated');
      const filePath = path.join(uploadsDir, safeFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Generated image not found.' });
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(filePath);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};
