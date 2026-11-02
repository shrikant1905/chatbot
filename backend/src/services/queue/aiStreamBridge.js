import { createRedisClient, isRedisReady, redisManager } from './redisConnection.js';

let pubClient = null;
let subClient = null;

// Map of jobId -> { onChunk, onDone, onError, timeout }
const listeners = new Map();
// Map of jobId -> AbortController for worker-side abort listeners
const workerAbortControllers = new Map();

function ensureSubscriber() {
  if (!subClient && isRedisReady()) {
    subClient = createRedisClient('RedisSubscriber');

    subClient.on('message', (channel, message) => {
      try {
        const payload = JSON.parse(message);

        // Check if stream channel: kiaan:stream:<jobId>
        if (channel.startsWith('kiaan:stream:')) {
          const jobId = channel.replace('kiaan:stream:', '');
          const handler = listeners.get(jobId);
          if (!handler) return;

          if (payload.type === 'chunk' && handler.onChunk) {
            handler.onChunk(payload.delta);
          } else if (payload.type === 'done') {
            if (handler.onDone) handler.onDone(payload.result);
            AiStreamBridge.unsubscribe(jobId);
          } else if (payload.type === 'error') {
            if (handler.onError) handler.onError(new Error(payload.error || 'AI generation failed'));
            AiStreamBridge.unsubscribe(jobId);
          }
        }

        // Check if abort channel: kiaan:abort:<jobId>
        if (channel.startsWith('kiaan:abort:')) {
          const jobId = channel.replace('kiaan:abort:', '');
          const abortCtrl = workerAbortControllers.get(jobId);
          if (abortCtrl && !abortCtrl.signal.aborted) {
            console.log(`[StreamBridge] Received abort signal for job ${jobId}`);
            abortCtrl.abort();
          }
        }
      } catch (err) {
        console.error('[StreamBridge] Error parsing pubsub message:', err);
      }
    });
  }
  return subClient;
}

function ensurePublisher() {
  if (!pubClient && isRedisReady()) {
    pubClient = createRedisClient('RedisPublisher');
  }
  return pubClient;
}

export class AiStreamBridge {
  /**
   * Subscribe to live token streaming for a job.
   */
  static async subscribe(jobId, { onChunk, onDone, onError, timeoutMs = 180000 }) {
    if (!isRedisReady()) {
      throw new Error('Redis is not ready for streaming subscription');
    }

    const sub = ensureSubscriber();
    const channel = `kiaan:stream:${jobId}`;

    const timeout = setTimeout(() => {
      const handler = listeners.get(jobId);
      if (handler) {
        if (handler.onError) handler.onError(new Error('Job response timed out'));
        AiStreamBridge.unsubscribe(jobId);
      }
    }, timeoutMs);

    listeners.set(jobId, { onChunk, onDone, onError, timeout });

    try {
      await sub.subscribe(channel);
    } catch (err) {
      clearTimeout(timeout);
      listeners.delete(jobId);
      throw err;
    }
  }

  /**
   * Unsubscribe and cleanup listeners for a job.
   */
  static async unsubscribe(jobId) {
    const handler = listeners.get(jobId);
    if (handler) {
      if (handler.timeout) clearTimeout(handler.timeout);
      listeners.delete(jobId);
    }

    if (subClient && isRedisReady()) {
      try {
        await subClient.unsubscribe(`kiaan:stream:${jobId}`);
      } catch {
        // Non-blocking
      }
    }
  }

  /**
   * Worker publishes a chunk of text to the client.
   */
  static async publishChunk(jobId, delta) {
    const pub = ensurePublisher();
    if (!pub || !isRedisReady()) return;
    try {
      await pub.publish(`kiaan:stream:${jobId}`, JSON.stringify({ type: 'chunk', delta }));
    } catch (err) {
      console.warn(`[StreamBridge] Failed to publish chunk for ${jobId}:`, err.message);
    }
  }

  /**
   * Worker publishes the completed result.
   */
  static async publishDone(jobId, result) {
    const pub = ensurePublisher();
    if (!pub || !isRedisReady()) return;
    try {
      await pub.publish(`kiaan:stream:${jobId}`, JSON.stringify({ type: 'done', result }));
    } catch (err) {
      console.warn(`[StreamBridge] Failed to publish done for ${jobId}:`, err.message);
    }
  }

  /**
   * Worker publishes an error.
   */
  static async publishError(jobId, errorMessage) {
    const pub = ensurePublisher();
    if (!pub || !isRedisReady()) return;
    try {
      await pub.publish(`kiaan:stream:${jobId}`, JSON.stringify({ type: 'error', error: errorMessage }));
    } catch (err) {
      console.warn(`[StreamBridge] Failed to publish error for ${jobId}:`, err.message);
    }
  }

  /**
   * Client signals worker to abort generation.
   */
  static async publishAbort(jobId) {
    const pub = ensurePublisher();
    if (!pub || !isRedisReady()) return;
    try {
      await pub.publish(`kiaan:abort:${jobId}`, JSON.stringify({ type: 'abort' }));
    } catch (err) {
      console.warn(`[StreamBridge] Failed to publish abort for ${jobId}:`, err.message);
    }
  }

  /**
   * Register a worker-side AbortController for abort signaling.
   */
  static async registerWorkerAbort(jobId, abortController) {
    const sub = ensureSubscriber();
    workerAbortControllers.set(jobId, abortController);
    if (sub && isRedisReady()) {
      try {
        await sub.subscribe(`kiaan:abort:${jobId}`);
      } catch {
        // Non-blocking
      }
    }
  }

  /**
   * Unregister worker-side AbortController after job completes.
   */
  static async unregisterWorkerAbort(jobId) {
    workerAbortControllers.delete(jobId);
    if (subClient && isRedisReady()) {
      try {
        await subClient.unsubscribe(`kiaan:abort:${jobId}`);
      } catch {
        // Non-blocking
      }
    }
  }

  /**
   * Graceful cleanup.
   */
  static async close() {
    listeners.clear();
    workerAbortControllers.clear();
    if (pubClient) {
      try { await pubClient.quit(); } catch { pubClient.disconnect(); }
      pubClient = null;
    }
    if (subClient) {
      try { await subClient.quit(); } catch { subClient.disconnect(); }
      subClient = null;
    }
  }
}

redisManager.on('close', () => {
  if (pubClient) {
    try { pubClient.disconnect(); } catch {}
    pubClient = null;
  }
  if (subClient) {
    try { subClient.disconnect(); } catch {}
    subClient = null;
  }
});
