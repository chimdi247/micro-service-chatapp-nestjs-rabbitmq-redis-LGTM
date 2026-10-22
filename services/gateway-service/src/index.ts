import { createApp } from '@/app';
import { createServer } from 'http';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { shutdownTelemetry } from '@chatapp/common';

const main = async () => {
  try {
    const app = createApp();
    const server = createServer(app);

    const port = env.GATEWAY_PORT;

    server.listen(port, () => {
      logger.info({ port }, 'Gateway service is running');
    });

    const shutdown = () => {
      logger.info('Shutting down gateway service...');
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
    logger.error({ error }, 'Failed to start gateway service');
    process.exit(1);
  }
};

void main();
