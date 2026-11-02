import { Worker } from 'bullmq';
import { getSharedRedisClient, isRedisReady } from './redisConnection.js';
import { IMAGE_QUEUE_NAME, inMemoryImageQueue } from './imageQueue.js';
import { generateComfyUIImage } from '../image/comfyUIService.js';
import { config } from '../../config/index.js';

let imageWorker = null;
let isProcessingInMemory = false;

/**
 * Core image job processor.
 */
async function processImageJob(job) {
  const { prompt, negativePrompt, width, height, steps, cfg } = job.data;
  console.log(`[Image Worker] Starting Image Generation (Job ${job.id}): "${prompt}"`);

  const result = await generateComfyUIImage(
    {
      prompt,
      negativePrompt,
      width: width || 512,
      height: height || 512,
      steps: steps || 20,
      cfg: cfg || 7.0
    },
    (progress) => {
      if (job.updateProgress) {
        job.updateProgress(progress).catch(() => {});
      }
    }
  );

  console.log(`[Image Worker] Completed Image Generation (Job ${job.id}) -> ${result.filename}`);
  return result;
}

/**
 * Initialize BullMQ Image Worker (Strict Concurrency 1 on CPU).
 */
export function initImageWorker() {
  if (imageWorker) return imageWorker;

  if (!config.redis?.enabled || !isRedisReady()) {
    console.log('[Image Worker] Redis server not connected. In-memory processor will handle image jobs.');
    return null;
  }

  const redis = getSharedRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const concurrency = config.comfyUI?.concurrency || 1;

    imageWorker = new Worker(
      IMAGE_QUEUE_NAME,
      async (job) => {
        return await processImageJob(job);
      },
      {
        connection: redis,
        concurrency,
        limiter: {
          max: 1,
          duration: 1000
        }
      }
    );

    imageWorker.on('completed', (job, result) => {
      console.log(`[BullMQ Image Worker] Job ${job.id} completed successfully.`);
    });

    imageWorker.on('failed', (job, err) => {
      console.error(`[BullMQ Image Worker] Job ${job?.id} failed:`, err.message);
    });

    imageWorker.on('error', (err) => {
      console.warn('[BullMQ Image Worker Error]:', err.message);
    });

    console.log(`[Image Worker] BullMQ Image Worker active (Concurrency: ${concurrency})`);
    return imageWorker;
  } catch (err) {
    console.warn('[Image Worker] Failed to start BullMQ Image Worker:', err.message);
    return null;
  }
}

/**
 * Fallback processor for in-memory image jobs (when Redis is offline)
 */
export async function processNextInMemoryImageJob() {
  if (isProcessingInMemory) return;
  isProcessingInMemory = true;

  try {
    for (const [id, job] of inMemoryImageQueue.jobs.entries()) {
      if (job.status === 'waiting') {
        job.status = 'active';
        try {
          const result = await processImageJob(job);
          job.status = 'completed';
          job.result = result;
        } catch (err) {
          job.status = 'failed';
          job.error = err.message;
        }
      }
    }
  } finally {
    isProcessingInMemory = false;
  }
}

/**
 * Gracefully close the BullMQ Image Worker.
 */
export async function closeImageWorker() {
  if (imageWorker) {
    try {
      await imageWorker.close();
      imageWorker = null;
      console.log('[Image Worker] Closed BullMQ Image Worker.');
    } catch (err) {
      console.warn('[Image Worker Close Error]:', err.message);
    }
  }
}
