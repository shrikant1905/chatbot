import IORedis from 'ioredis';
import { EventEmitter } from 'events';
import { config } from '../../config/index.js';

class RedisManager extends EventEmitter {
  constructor() {
    super();
    this.sharedClient = null;
    this.isConnected = false;
    this.hasLoggedError = false;
  }

  getConfig() {
    return {
      host: config.redis?.host || '127.0.0.1',
      port: config.redis?.port || 6379,
      password: config.redis?.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
      retryStrategy(times) {
        // Reconnect attempt every 10 seconds to avoid spamming CPU
        return 10000;
      }
    };
  }

  createClient(label = 'RedisClient') {
    const opts = this.getConfig();
    const client = new IORedis(opts);

    client.on('ready', () => {
      this.isConnected = true;
      this.hasLoggedError = false;
      console.log(`[${label}] Connected and ready on ${opts.host}:${opts.port}`);
      this.emit('ready', client);
    });

    client.on('error', (err) => {
      this.isConnected = false;
      if (!this.hasLoggedError) {
        console.warn(`[${label}] Redis server unavailable (${err.code || err.message}). In-memory queue fallback active.`);
        this.hasLoggedError = true;
      }
      this.emit('unavailable', err);
    });

    client.on('close', () => {
      if (this.isConnected) {
        this.isConnected = false;
        console.warn(`[${label}] Redis connection closed. Falling back to in-memory queue.`);
        this.emit('close');
      }
    });

    return client;
  }

  getSharedClient() {
    if (!this.sharedClient && config.redis?.enabled) {
      this.sharedClient = this.createClient('Redis');
    }
    return this.sharedClient;
  }

  isReady() {
    return this.isConnected && Boolean(config.redis?.enabled);
  }

  async close() {
    if (this.sharedClient) {
      try {
        await this.sharedClient.quit();
      } catch {
        this.sharedClient.disconnect();
      }
      this.sharedClient = null;
    }
    this.isConnected = false;
  }
}

export const redisManager = new RedisManager();
export const redisConfig = redisManager.getConfig();

export function createRedisClient(label) {
  return redisManager.createClient(label);
}

export function getSharedRedisClient() {
  return redisManager.getSharedClient();
}

export function isRedisReady() {
  return redisManager.isReady();
}

export async function closeRedisConnections() {
  return redisManager.close();
}
