import { Queue } from 'bullmq';
import { redisConfig, isRedisReady } from './redisConnection.js';
import { config } from '../../config/index.js';

export const QUEUE_NAME = 'kiaanai-ai-generation';

let aiQueue = null;

export function getAiQueue() {
  if (!aiQueue && isRedisReady()) {
    try {
      aiQueue = new Queue(QUEUE_NAME, {
        connection: redisConfig,
        defaultJobOptions: {
          attempts: config.redis?.attempts || 2,
          backoff: {
            type: 'exponential',
            delay: config.redis?.backoffDelay || 3000
          },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 86400, count: 500 }
        }
      });

      aiQueue.on('error', (err) => {
        console.warn('[AI Queue] Error:', err.message);
      });
    } catch (err) {
      console.warn('[AI Queue] Initialization error:', err.message);
      aiQueue = null;
    }
  }
  return aiQueue;
}

/**
 * Add an inference job to BullMQ queue.
 */
export async function enqueueAiJob(data, options = {}) {
  const queue = getAiQueue();
  if (!queue) {
    throw new Error('AI Queue is not available (Redis disconnected).');
  }

  const job = await queue.add('generate-response', data, {
    jobId: data.jobId,
    priority: options.priority || 0,
    ...options
  });

  return job;
}

/**
 * Get live queue metrics for status/health checks.
 */
export async function getAiQueueMetrics() {
  const queue = getAiQueue();
  if (!queue || !isRedisReady()) {
    return {
      connected: false,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    };
  }

  try {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount().catch(() => 0),
      queue.getActiveCount().catch(() => 0),
      queue.getCompletedCount().catch(() => 0),
      queue.getFailedCount().catch(() => 0)
    ]);

    return {
      connected: true,
      waiting,
      active,
      completed,
      failed
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

/**
 * Close queue gracefully on shutdown.
 */
export async function closeAiQueue() {
  if (aiQueue) {
    try {
      await aiQueue.close();
    } catch {
      // Non-blocking
    }
    aiQueue = null;
  }
}

