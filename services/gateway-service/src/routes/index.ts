import type { Router } from 'express';
import { authRouter } from '@/routes/auth.routes';
import { userRouter } from '@/routes/user.routes';
import { conversationRouter } from './conversation.routes';

export const registerRoutes = (app: Router) => {
  // Health check endpoint for Docker/K8s
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'gateway-service' });
  });

  app.use('/auth', authRouter);
  app.use('/conversations', conversationRouter);
  app.use('/users', userRouter);
};
