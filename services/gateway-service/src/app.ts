import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createHttpTelemetryMiddleware } from '@chatapp/common';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/error-handler';
import { registerRoutes } from '@/routes';

export const createApp = (): Application => {
  const app = express();

  // First middleware: RED metrics + trace-correlated access log for every request.
  app.use(createHttpTelemetryMiddleware(logger));

  app.use(helmet());
  app.use(
    cors({
      origin: '*',
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  registerRoutes(app);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not Found' });
  });

  app.use(errorHandler);

  return app;
};
