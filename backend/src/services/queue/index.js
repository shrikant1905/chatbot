import { isRedisReady, closeRedisConnections, getSharedRedisClient } from './redisConnection.js';
import { enqueueAiJob, getAiQueueMetrics, closeAiQueue } from './aiQueue.js';
import { initAiWorker, closeAiWorker } from './aiWorker.js';
import { AiStreamBridge } from './aiStreamBridge.js';
import { concurrencyQueue } from './concurrencyQueue.js';
import { config } from '../../config/index.js';

/**
 * Check if the distributed Redis/BullMQ queue is active and usable.
 */
export function isBullMQActive() {
  return Boolean(config.redis?.enabled) && isRedisReady();
}

/**
 * Initialize queue services (worker and connections).
 */
export function initializeQueueServices() {
  if (config.redis?.enabled) {
    try {
      getSharedRedisClient(); // Kick-off initial connection
      initAiWorker();
    } catch (err) {
      console.warn('[Queue Initialization] Redis unavailable, fallback mode active:', err.message);
    }
  } else {
    console.log('[Queue] Redis queue is disabled by config (AI_QUEUE_ENABLED=false). Running in memory queue.');
  }
}

/**
 * Graceful shutdown for all queue services and connections.
 */
export async function closeAllQueueServices() {
  console.log('[Shutdown] Closing BullMQ Worker and Redis connections...');
  await Promise.allSettled([
    closeAiWorker(),
    closeAiQueue(),
    AiStreamBridge.close(),
    closeRedisConnections()
  ]);
  console.log('[Shutdown] Queue services closed.');
}

export {
  isRedisReady,
  enqueueAiJob,
  getAiQueueMetrics,
  closeAiQueue,
  initAiWorker,
  closeAiWorker,
  AiStreamBridge,
  concurrencyQueue
};

