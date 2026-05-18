import express from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { applySecurityMiddleware } from './presentation/middleware/security.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';
import apiRoutes from './presentation/routes/index.js';

export function createApp() {
  const app = express();

  applySecurityMiddleware(app);

  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/', (_req, res) => {
    res.json({
      name: 'CloudCart Pro API',
      version: '1.0.0',
      docs: `${env.API_PREFIX}/health`,
    });
  });

  app.use(env.API_PREFIX, apiRoutes);

  app.use(errorHandler);

  return app;
}
