import EventEmitter from 'events';
import crypto from 'crypto';

/**
 * ConcurrencyQueue
 * 
 * Manages CPU inference workload by enforcing a strict concurrency limit (default: 2)
 * on the 8-vCPU VPS. Queues burst traffic cleanly with priority and abort handling.
 * (Prompt caching is intentionally disabled to guarantee fresh live answers per chat).
 */
class ConcurrencyQueue extends EventEmitter {
  constructor({ maxConcurrency = 2 } = {}) {
    super();
    this.maxConcurrency = maxConcurrency;
    this.activeWorkers = 0;
    this.queue = [];
    this.totalProcessed = 0;
    this.totalRejected = 0;
  }

  /**
   * Enqueue an inference task through the concurrency governor.
   * @param {Function} taskFn - Async function returning the inference stream/result.
   * @param {Object} options - { priority, model, messages, signal }
   */
  async enqueue(taskFn, { signal, priority = 0 } = {}) {
    return new Promise((resolve, reject) => {
      const job = {
        id: crypto.randomUUID(),
        taskFn,
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
      cachedEntries: 0,
      totalProcessed: this.totalProcessed
    };
  }
}

export const concurrencyQueue = new ConcurrencyQueue({
  maxConcurrency: parseInt(process.env.AI_MAX_CONCURRENCY || '2', 10)
});
