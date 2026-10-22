import { registerMongoPoolMetrics } from '@chatapp/common';
import { MongoClient } from 'mongodb';

import { env } from '@/config/env';
import { logger } from '@/utils/logger';

let client: MongoClient | null = null;

export const getMongoClient = async (): Promise<MongoClient> => {
  if (client) {
    return client;
  }

  const mongoUrl = env.MONGO_URL;
  // Explicit pool sizing so "% of pool in use" has a meaningful denominator.
  client = new MongoClient(mongoUrl, {
    maxPoolSize: env.MONGO_MAX_POOL_SIZE,
    minPoolSize: env.MONGO_MIN_POOL_SIZE,
    waitQueueTimeoutMS: env.MONGO_WAIT_QUEUE_TIMEOUT_MS,
  });
  // Driver CMAP events -> chatapp_db_pool_* metrics (client/server connections,
  // waiters, % in use). Must be attached before connect().
  registerMongoPoolMetrics(client, { maxPoolSize: env.MONGO_MAX_POOL_SIZE });
  await client.connect();
  logger.info('MongoDB connection established');

  return client;
};

export const closeMongoClient = async () => {
  if (!client) {
    return;
  }
  await client.close();
  logger.info('MongoDB connection closed');
  client = null;
};
