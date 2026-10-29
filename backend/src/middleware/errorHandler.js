import { config } from '../config/index.js';

export function errorHandler(err, req, res, next) {
  console.error('[Error]', err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected internal error occurred';

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || 'SERVER_ERROR',
    ...(config.env === 'development' && { stack: err.stack })
  });
}

