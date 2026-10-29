import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { apiRouter } from './routes/apiRouter.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: [config.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
      credentials: true
    })
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Basic request logger in dev
  if (config.env === 'development') {
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      next();
    });
  }

  // Mount API router
  app.use('/api', apiRouter);

  // 404 Handler for API routes
  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}
