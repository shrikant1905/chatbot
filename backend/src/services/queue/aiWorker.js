import { Worker } from 'bullmq';
import { QUEUE_NAME } from './aiQueue.js';
import { redisConfig, isRedisReady, redisManager } from './redisConnection.js';
import { AiStreamBridge } from './aiStreamBridge.js';
import { getAiProvider, resolveAiProvider } from '../ai/index.js';
import { config } from '../../config/index.js';

let worker = null;

/**
 * Initializes the BullMQ Worker when Redis is ready.
 */
export function initAiWorker() {
  if (worker) return worker;
  if (!config.redis?.enabled || !isRedisReady()) {
    return null;
  }

  const concurrency = config.redis?.concurrency || 1;

  try {
    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const {
          jobId,
          model,
          messages,
          attachments,
          userMemories,
          webSearch,
          stream
        } = job.data;

        console.log(`[AI Worker] Processing Job ${job.id} (${model || 'default'})`);

        const abortController = new AbortController();
        await AiStreamBridge.registerWorkerAbort(jobId, abortController);

        try {
          const aiProvider = resolveAiProvider(model);

          const result = await aiProvider.generateResponse({
            model,
            messages,
            attachments,
            userMemories,
            webSearch,
            stream: Boolean(stream),
            onChunk: (chunk) => {
              if (stream) {
                AiStreamBridge.publishChunk(jobId, chunk);
              }
            },
            signal: abortController.signal
          });

          // Publish completion event for stream subscriber
          await AiStreamBridge.publishDone(jobId, result);
          return result;
        } catch (err) {
          console.error(`[AI Worker] Job ${job.id} error:`, err.message);
          await AiStreamBridge.publishError(jobId, err.message);
          throw err;
        } finally {
          await AiStreamBridge.unregisterWorkerAbort(jobId);
        }
      },
      {
        connection: redisConfig,
        concurrency
      }
    );

    worker.on('ready', () => {
      console.log(`[AI Worker] Ready with concurrency limit: ${concurrency}`);
    });

    worker.on('error', (err) => {
      console.warn('[AI Worker] Notice:', err.message);
    });

    worker.on('completed', (job) => {
      console.log(`[AI Worker] Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
      console.warn(`[AI Worker] Job ${job?.id} failed: ${err.message}`);
    });
  } catch (err) {
    console.warn('[AI Worker] Initialization failed:', err.message);
    worker = null;
  }

  return worker;
}

/**
 * Close worker cleanly on server shutdown or redis disconnection.
 */
export async function closeAiWorker() {
  if (worker) {
    const currentWorker = worker;
    worker = null;
    try {
      await currentWorker.close();
    } catch {
      // Non-blocking
    }
  }
}

// Auto-bind worker lifecycle to Redis connection state
redisManager.on('ready', () => {
  if (!worker && config.redis?.enabled) {
    console.log('[AI Worker] Redis is ready. Spawning BullMQ worker...');
    initAiWorker();
  }
});

redisManager.on('close', () => {
  if (worker) {
    closeAiWorker();
  }
});
