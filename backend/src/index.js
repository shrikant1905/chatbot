import { createApp } from './app.js';
import { config } from './config/index.js';
import { runMigrations } from './db/migrate.js';
import { closePool } from './db/pool.js';
import { initializeQueueServices, closeAllQueueServices } from './services/queue/index.js';

async function bootstrap() {
  try {
    console.log('[Startup] Running database migrations...');
    await runMigrations();

    // Initialize BullMQ worker & Redis connections (with automatic in-memory fallback)
    initializeQueueServices();

    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`===============================================`);
      console.log(`  Kiaan AI Backend Server Running`);
      console.log(`  Port: http://localhost:${config.port}`);
      console.log(`  Health Check: http://localhost:${config.port}/api/health`);
      console.log(`  AI Provider: ${config.ai.provider}`);
      console.log(`===============================================`);
    });

    const shutdown = async (signal) => {
      console.log(`\n[Shutdown] Received ${signal}, closing server gracefully...`);
      server.close(async () => {
        await closeAllQueueServices();
        await closePool();
        console.log('[Shutdown] Database connections closed. Process exited.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('[Fatal Startup Error]', err);
    process.exit(1);
  }
}

bootstrap();
