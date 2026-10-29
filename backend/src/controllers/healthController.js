import fs from 'fs';
import { testConnection } from '../db/pool.js';
import { getAiProvider } from '../services/ai/index.js';
import { config } from '../config/index.js';

export class HealthController {
  static async check(req, res) {
    const startTime = Date.now();

    let dbOk = false;
    let dbError = null;
    try {
      dbOk = await testConnection();
    } catch (err) {
      dbError = err.message;
    }

    const uploadsWritable = fs.existsSync(config.upload.dir);

    const provider = getAiProvider();
    let aiStatus = { available: false, error: 'Not checked' };
    try {
      aiStatus = await provider.checkAvailability();
    } catch (err) {
      aiStatus = { available: false, error: err.message };
    }

    const isHealthy = dbOk && uploadsWritable;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      database: {
        connected: dbOk,
        error: dbError
      },
      storage: {
        uploadsDirectory: config.upload.dir,
        ready: uploadsWritable
      },
      aiProvider: {
        configuredProvider: provider.name,
        available: aiStatus.available,
        error: aiStatus.error || null
      },
      system: {
        nodeVersion: process.version,
        environment: config.env,
        uptimeSeconds: Math.floor(process.uptime())
      }
    });
  }
}

