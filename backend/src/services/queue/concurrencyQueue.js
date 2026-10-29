import EventEmitter from 'events';
import crypto from 'crypto';

/**
 * ConcurrencyQueue
 * 
 * Manages CPU inference workload by enforcing a strict concurrency limit (default: 2)
 * on the 8-vCPU VPS. Queues burst traffic cleanly and provides hot-caching for
 * identical prompt deduplication.
 */
class ConcurrencyQueue extends EventEmitter {
  constructor({ maxConcurrency = 2, cacheTtlMs = 600000 } = {}) {
    super();
    this.maxConcurrency = maxConcurrency;
    this.activeWorkers = 0;
    this.queue = [];
    this.cacheTtlMs = cacheTtlMs; // Default 10 mins cache TTL
    this.cache = new Map();
    this.totalProcessed = 0;
    this.totalRejected = 0;
  }

  /**
   * Generates a deterministic hash for caching prompt requests.
   */
  getCacheKey(model, messages) {
    if (!messages || messages.length === 0) return null;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user') return null;
    return crypto.createHash('sha256').update(`${model}:${lastMsg.content}`).digest('hex');
  }

  /**
   * Check cache for identical recent prompt.
   */
  getFromCache(cacheKey) {
    if (!cacheKey || !this.cache.has(cacheKey)) return null;
    const entry = this.cache.get(cacheKey);
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }
    return entry.value;
  }

  /**
   * Store result in cache.
   */
  setInCache(cacheKey, value) {
    if (!cacheKey) return;
    this.cache.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.cacheTtlMs
    });

    // Simple cache pruning if map grows large
    if (this.cache.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now > v.expiresAt) this.cache.delete(k);
      }
    }
  }

  /**
   * Enqueue an inference task through the concurrency governor.
   * @param {Function} taskFn - Async function returning the inference stream/result.
   * @param {Object} options - { priority, model, messages, signal }
   */
  async enqueue(taskFn, { model, messages, signal, priority = 0 } = {}) {
    // 1. Check hot cache for exact prompt match
    const cacheKey = this.getCacheKey(model, messages);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.emit('cache_hit', { cacheKey, model });
      return { fromCache: true, ...cached };
    }

    // 2. Wrap in queuing promise
    return new Promise((resolve, reject) => {
      const job = {
        id: crypto.randomUUID(),
        taskFn,
        cacheKey,
        signal,
        priority,
        enqueuedAt: Date.now(),
        resolve,
        reject
      };

      if (signal?.aborted) {
        return reject(new Error('Generation cancelled before processing slot was available.'));
      }

      if (signal) {
        signal.addEventListener('abort', () => {
          const idx = this.queue.indexOf(job);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
            reject(new Error('Generation cancelled by user.'));
          }
        });
      }

      this.queue.push(job);
      this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first

      this.emit('job_enqueued', { jobId: job.id, queueLength: this.queue.length });
      this.processNext();
    });
  }

  /**
   * Process next queued job if concurrency ceiling allows.
   */
  async processNext() {
    if (this.activeWorkers >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    if (job.signal?.aborted) {
      job.reject(new Error('Generation cancelled by user.'));
      return this.processNext();
    }

    this.activeWorkers++;
    this.emit('job_started', { jobId: job.id, activeWorkers: this.activeWorkers });

    try {
      const result = await job.taskFn();
      this.totalProcessed++;

      // Cache successful response
      if (job.cacheKey && result && result.content) {
        this.setInCache(job.cacheKey, { content: result.content, model: result.model });
      }

      job.resolve(result);
    } catch (err) {
      job.reject(err);
    } finally {
      this.activeWorkers--;
      this.emit('job_finished', { jobId: job.id, activeWorkers: this.activeWorkers });
      this.processNext();
    }
  }

  /**
   * Live queue telemetry for dashboard / health check.
   */
  getMetrics() {
    return {
      maxConcurrency: this.maxConcurrency,
      activeWorkers: this.activeWorkers,
      queuedJobs: this.queue.length,
      cachedEntries: this.cache.size,
      totalProcessed: this.totalProcessed
    };
  }
}

export const concurrencyQueue = new ConcurrencyQueue({
  maxConcurrency: parseInt(process.env.AI_MAX_CONCURRENCY || '2', 10),
  cacheTtlMs: parseInt(process.env.AI_CACHE_TTL_MS || '600000', 10)
});

