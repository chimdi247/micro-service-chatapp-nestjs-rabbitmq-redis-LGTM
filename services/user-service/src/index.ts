import { createApp } from '@/app';
import { createServer } from 'http';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { shutdownTelemetry } from '@chatapp/common';
import { initializeDatabase } from '@/db/sequelize';
import { startAuthEventConsumer } from '@/messaging/auth-consumer';
import { initMessaging } from '@/messaging/event-publisher';

const main = async () => {
  try {
    await initializeDatabase();
    await initMessaging();
    await startAuthEventConsumer();

    const app = createApp();
    const server = createServer(app);

    const port = env.USER_SERVICE_PORT;

    server.listen(port, () => {
      logger.info({ port }, 'User service is running');
    });

    const shutdown = () => {
      logger.info('Shutting down user service...');
      Promise.all([])
        .catch((error: unknown) => {
          logger.error({ error }, 'Error during shutdown tasks');
        })
        .finally(() => {
          server.close(() => {
            void shutdownTelemetry().finally(() => process.exit(0));
          });
        });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error({ error }, 'Failed to start user service');
    process.exit(1);
  }
};

void main();
