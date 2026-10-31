import fs from 'fs';
import { testConnection } from '../db/pool.js';
import { getAiProvider } from '../services/ai/index.js';
import { config } from '../config/index.js';
import { concurrencyQueue } from '../services/queue/concurrencyQueue.js';

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
        uptimeSeconds: Math.floor(process.uptime()),
        gatewayQueue: concurrencyQueue.getMetrics()
      }
    });
  }

  /**
   * Diagnostic Benchmark Endpoint: GET /api/health/benchmark
   * Pinpoints latency across MySQL, VPS Network Ping, and Ollama Model Inference.
   */
  static async benchmark(req, res) {
    const results = {};
    const t0 = performance.now();

    // 1. MySQL Latency
    try {
      const dbStart = performance.now();
      await testConnection();
      results.mysql = `${Math.round(performance.now() - dbStart)}ms`;
    } catch (e) {
      results.mysql = `Failed: ${e.message}`;
    }

    // 2. VPS Network Ping
    const ollamaUrl = (config.ai.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    try {
      const pingStart = performance.now();
      const pingRes = await fetch(`${ollamaUrl}/api/version`);
      const pingData = await pingRes.json().catch(() => ({}));
      results.vpsNetworkPing = `${Math.round(performance.now() - pingStart)}ms (Ollama ${pingData.version || 'ok'})`;
    } catch (e) {
      results.vpsNetworkPing = `Failed: ${e.message}`;
    }

    // 3. Model Inference (Single 3-word test)
    const model = req.query.model || config.ai.ollamaDefaultModel || 'gemma3:4b';
    try {
      const inferStart = performance.now();
      const inferRes = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say OK' }],
          stream: false,
          keep_alive: '24h',
          options: { num_predict: 5, num_thread: 8 }
        })
      });
      const inferData = await inferRes.json().catch(() => ({}));
      const inferDuration = Math.round(performance.now() - inferStart);
      results.modelInference = `${inferDuration}ms (Model: ${model}, Reply: "${inferData.message?.content?.trim() || ''}")`;
    } catch (e) {
      results.modelInference = `Failed: ${e.message}`;
    }

    results.totalBenchmarkDuration = `${Math.round(performance.now() - t0)}ms`;
    res.json({ success: true, timestamp: new Date().toISOString(), results });
  }
}
