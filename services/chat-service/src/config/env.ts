import 'dotenv/config';

import { createEnv, z } from '@chatapp/common';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CHAT_SERVICE_PORT: z.coerce.number().int().min(0).max(65_535).default(4000),
  MONGO_URL: z.string(),
  REDIS_URL: z.string(),
  MONGO_MAX_POOL_SIZE: z.coerce.number().int().min(1).default(20),
  MONGO_MIN_POOL_SIZE: z.coerce.number().int().min(0).default(2),
  MONGO_WAIT_QUEUE_TIMEOUT_MS: z.coerce.number().int().min(0).default(5000),
  RABBITMQ_URL: z.string().optional(),
  INTERNAL_API_TOKEN: z.string().min(16),
  JWT_SECRET: z.string().min(32),
});

type EnvType = z.infer<typeof envSchema>;

export const env: EnvType = createEnv(envSchema, {
  serviceName: 'chat-service',
});

export type Env = typeof env;
