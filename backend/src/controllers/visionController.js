import fs from 'fs/promises';
import { config } from '../config/index.js';
import { getPool } from '../db/pool.js';

export class VisionController {
  /**
   * Dedicated Vision Analysis Endpoint: POST /api/ai/image/analyze
   * Supports file upload ('image'), attachmentId, or raw base64.
   */
  static async analyzeImage(req, res, next) {
    try {
      const { prompt = 'Describe this image in detail. Identify the main subject, visible text, and key details.', attachmentId } = req.body;
      const visionModel = process.env.OLLAMA_VISION_MODEL || 'qwen2.5vl:3b';
      let imageBase64 = null;

      // 1. Resolve image source
      if (req.file) {
        const fileBuffer = await fs.readFile(req.file.path);
        imageBase64 = fileBuffer.toString('base64');
      } else if (req.body.imageBase64) {
        imageBase64 = req.body.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      } else if (attachmentId) {
        const pool = getPool();
        const [rows] = await pool.query('SELECT * FROM attachments WHERE id = ?', [attachmentId]);
        if (rows.length > 0 && rows[0].storage_path) {
          const fileBuffer = await fs.readFile(rows[0].storage_path);
          imageBase64 = fileBuffer.toString('base64');
        }
      }

      if (!imageBase64) {
        return res.status(400).json({
          success: false,
          error: 'No image provided. Upload an image file, provide imageBase64, or specify an attachmentId.'
        });
      }

      // 2. Query Ollama Vision Model
      const ollamaUrl = (config.ai.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
      const payload = {
        model: visionModel,
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [imageBase64]
          }
        ],
        stream: false,
        options: {
          num_ctx: 2048,
          num_thread: 6,
          num_predict: 256
        }
      };

      const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text().catch(() => '');
        return res.status(ollamaRes.status).json({
          success: false,
          error: `Ollama vision analysis error: ${errText || ollamaRes.statusText}`,
          model: visionModel
        });
      }

      const data = await ollamaRes.json();
      const analysis = data.message?.content || 'No description returned.';

      res.json({
        success: true,
        model: visionModel,
        prompt,
        analysis,
        tokensUsed: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      });
    } catch (err) {
      next(err);
    }
  }
}

