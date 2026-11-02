import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../config/index.js';
import { buildTextToImageWorkflow } from './comfyWorkflows.js';

const COMFY_URL = config.comfyUI?.baseUrl || 'http://127.0.0.1:8188';

/**
 * Check if the ComfyUI backend server is running and reachable.
 */
export async function checkComfyUIHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${COMFY_URL}/system_stats`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { healthy: false, error: `HTTP ${res.status}` };
    const stats = await res.json();
    return { healthy: true, stats };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

/**
 * High-speed fallback image generator when ComfyUI is offline or unreachable.
 * Saves directly into the KiaanAI storage directory with identical metadata.
 */
export async function generateFallbackImage(options = {}) {
  const uploadsDir = path.resolve(config.upload?.dir || 'uploads', 'generated');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const prompt = options.prompt || 'Modern AI Chatbot Logo, sleek vector style';
  const width = options.width || 512;
  const height = options.height || 512;
  const targetFilename = `kiaanai-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
  const targetPath = path.join(uploadsDir, targetFilename);

  const seed = Math.floor(Math.random() * 999999);
  const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

  const res = await fetch(pollUrl);
  if (!res.ok) {
    throw new Error(`AI image generation engine returned HTTP ${res.status}`);
  }

  const imageBuffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(targetPath, imageBuffer);

  const relativeUrl = `/api/images/file/${targetFilename}`;

  return {
    filename: targetFilename,
    localPath: targetPath,
    relativeUrl,
    promptId: `ai-gen-${seed}`,
    prompt,
    sizeBytes: imageBuffer.length,
    engine: 'AI Image Engine'
  };
}

/**
 * Trigger ComfyUI text-to-image generation and wait for the resulting image.
 * If ComfyUI is offline or unreachable, seamlessly falls back to the high-speed AI image engine.
 *
 * @param {Object} options
 * @param {string} options.prompt - Positive text prompt
 * @param {string} [options.negativePrompt] - Negative prompt
 * @param {number} [options.width=512]
 * @param {number} [options.height=512]
 * @param {number} [options.steps=20]
 * @param {number} [options.cfg=7.0]
 * @param {string} [options.sampler='euler_ancestral']
 * @param {function} [onProgress] - Optional progress callback ({ step, total, status })
 * @returns {Promise<{ filename: string, localPath: string, relativeUrl: string, promptId: string, engine?: string }>}
 */
export async function generateComfyUIImage(options = {}, onProgress = null) {
  const isHealthy = await checkComfyUIHealth();
  if (!isHealthy.healthy) {
    console.log(`[Image Generation] ComfyUI offline at ${COMFY_URL}, using AI image engine.`);
    if (onProgress) {
      onProgress({ status: 'generating', message: 'Generating image with AI Image Engine...' });
    }
    return generateFallbackImage(options);
  }

  const clientId = `kiaanai-${crypto.randomUUID()}`;
  const workflow = buildTextToImageWorkflow({
    prompt: options.prompt,
    negativePrompt: options.negativePrompt,
    checkpoint: config.comfyUI?.defaultModel || 'v1-5-pruned-emaonly.safetensors',
    steps: options.steps || config.comfyUI?.steps || 20,
    cfg: options.cfg || config.comfyUI?.cfg || 7.0,
    sampler: options.sampler || config.comfyUI?.sampler || 'euler_ancestral',
    scheduler: config.comfyUI?.scheduler || 'normal',
    width: options.width || config.comfyUI?.width || 512,
    height: options.height || config.comfyUI?.height || 512
  });

  if (onProgress) {
    onProgress({ status: 'queuing', message: 'Submitting prompt to ComfyUI...' });
  }

  // 1. Submit prompt to ComfyUI
  const promptRes = await fetch(`${COMFY_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: workflow,
      client_id: clientId
    })
  });

  if (!promptRes.ok) {
    const errorText = await promptRes.text();
    throw new Error(`ComfyUI /prompt rejected: ${promptRes.status} ${errorText}`);
  }

  const { prompt_id } = await promptRes.json();
  if (!prompt_id) {
    throw new Error('ComfyUI did not return a valid prompt_id');
  }

  if (onProgress) {
    onProgress({ status: 'generating', promptId: prompt_id, message: 'Stable Diffusion 1.5 is generating image...' });
  }

  // 2. Poll ComfyUI history for completion (with timeout)
  const maxWaitMs = 180000; // 3 minutes timeout for CPU inference
  const pollIntervalMs = 1200;
  const startTime = Date.now();
  let completedOutput = null;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    try {
      const histRes = await fetch(`${COMFY_URL}/history/${prompt_id}`);
      if (histRes.ok) {
        const historyData = await histRes.json();
        const item = historyData[prompt_id];

        if (item && item.outputs) {
          // Find SaveImage node (Node 9 in standard workflow)
          for (const nodeId of Object.keys(item.outputs)) {
            const nodeOutput = item.outputs[nodeId];
            if (nodeOutput.images && nodeOutput.images.length > 0) {
              completedOutput = nodeOutput.images[0];
              break;
            }
          }
        }

        if (completedOutput) break;

        // Check if job had errors
        if (item && item.status && item.status.status_str === 'error') {
          throw new Error(`ComfyUI execution error: ${JSON.stringify(item.status.messages || 'Unknown error')}`);
        }
      }
    } catch (pollErr) {
      console.warn('[ComfyUI Poll Warning]:', pollErr.message);
    }
  }

  if (!completedOutput) {
    throw new Error(`Image generation timed out after ${maxWaitMs / 1000}s on ComfyUI.`);
  }

  // 3. Download the generated image from ComfyUI /view
  const viewUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(completedOutput.filename)}&subfolder=${encodeURIComponent(completedOutput.subfolder || '')}&type=${encodeURIComponent(completedOutput.type || 'output')}`;
  const imageRes = await fetch(viewUrl);

  if (!imageRes.ok) {
    throw new Error(`Failed to download image from ComfyUI /view: HTTP ${imageRes.status}`);
  }

  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  // 4. Save into KiaanAI storage directory
  const uploadsDir = path.resolve(config.upload?.dir || 'uploads', 'generated');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const targetFilename = `kiaanai-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
  const targetPath = path.join(uploadsDir, targetFilename);
  fs.writeFileSync(targetPath, imageBuffer);

  const relativeUrl = `/api/images/file/${targetFilename}`;

  return {
    filename: targetFilename,
    localPath: targetPath,
    relativeUrl,
    promptId: prompt_id,
    prompt: options.prompt,
    sizeBytes: imageBuffer.length
  };
}
