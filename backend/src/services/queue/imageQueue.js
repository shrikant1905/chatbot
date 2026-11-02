import { Queue } from 'bullmq';
import { getSharedRedisClient, isRedisReady } from './redisConnection.js';
import { config } from '../../config/index.js';

export const IMAGE_QUEUE_NAME = 'kiaanai-image-generation';

let imageQueue = null;

// In-memory fallback queue for local development / offline Redis
class InMemoryImageQueue {
  constructor() {
    this.jobs = new Map();
    this.counter = 0;
  }

  async add(name, data, opts = {}) {
    const id = opts.jobId || `img-job-${Date.now()}-${++this.counter}`;
    const job = {
      id,
      name,
      data,
      opts,
      timestamp: Date.now(),
      status: 'waiting',
      result: null,
      error: null
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  async getMetrics() {
    let waiting = 0, active = 0, completed = 0, failed = 0;
    for (const job of this.jobs.values()) {
      if (job.status === 'waiting') waiting++;
      else if (job.status === 'active') active++;
      else if (job.status === 'completed') completed++;
      else if (job.status === 'failed') failed++;
    }
    return { waiting, active, completed, failed, total: this.jobs.size };
  }
}

export const inMemoryImageQueue = new InMemoryImageQueue();

/**
 * Get or create the BullMQ Image Queue instance.
 */
export function getOrCreateImageQueue() {
  if (imageQueue) return imageQueue;

  const redis = getSharedRedisClient();
  if (!redis) return null;

  try {
    imageQueue = new Queue(IMAGE_QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 1, // On CPU, never automatically retry heavy image generation
        removeOnComplete: {
          age: 3600, // 1 hour
          count: 500
        },
        removeOnFail: {
          age: 86400, // 24 hours
          count: 500
        }
      }
    });

    imageQueue.on('error', (err) => {
      console.warn('[BullMQ Image Queue Error]:', err.message);
    });

    console.log('[Queue] BullMQ Image Queue initialized:', IMAGE_QUEUE_NAME);
    return imageQueue;
  } catch (err) {
    console.warn('[Queue] Failed to initialize BullMQ Image Queue:', err.message);
    return null;
  }
}

/**
 * Enqueue a new image generation job.
 */
export async function enqueueImageJob(data, opts = {}) {
  const isRedisAvailable = Boolean(config.redis?.enabled) && isRedisReady();

  if (isRedisAvailable) {
    const queue = getOrCreateImageQueue();
    if (queue) {
      return await queue.add('generate-image', data, {
        jobId: opts.jobId || `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        priority: opts.priority || 1
      });
    }
  }

  // Resilient fallback to in-memory queue
  return await inMemoryImageQueue.add('generate-image', data, opts);
}

/**
 * Retrieve Image Queue health & metrics.
 */
export async function getImageQueueMetrics() {
  const isRedisAvailable = Boolean(config.redis?.enabled) && isRedisReady();

  if (isRedisAvailable && imageQueue) {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        imageQueue.getWaitingCount(),
        imageQueue.getActiveCount(),
        imageQueue.getCompletedCount(),
        imageQueue.getFailedCount()
      ]);
      return {
        connected: true,
        waiting,
        active,
        completed,
        failed
      };
    } catch (err) {
      console.warn('[BullMQ Image Metrics Warning]:', err.message);
    }
  }

  const fallbackMetrics = await inMemoryImageQueue.getMetrics();
  return {
    connected: false,
    ...fallbackMetrics
  };
}

/**
 * Close BullMQ Image Queue.
 */
export async function closeImageQueue() {
  if (imageQueue) {
    try {
      await imageQueue.close();
      imageQueue = null;
    } catch (err) {
      console.warn('[BullMQ Image Queue Close Error]:', err.message);
    }
  }
}

