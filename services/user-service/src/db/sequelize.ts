import { Sequelize } from 'sequelize';
import { registerSequelizePoolMetrics } from '@chatapp/common';

import { env } from '@/config/env';
import { logger } from '@/utils/logger';

export const sequelize = new Sequelize(env.USER_DB_URL, {
  dialect: 'postgres',
  logging:
    env.NODE_ENV === 'development'
      ? (msg: unknown) => {
          logger.debug({ sequelize: msg });
        }
      : false,
  // Explicit pool sizing: connections go through PgBouncer (transaction pooling).
  pool: {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    min: 0,
    acquire: 30_000,
    idle: 10_000,
  },
  define: {
    underscored: true,
    freezeTableName: true,
  },
});

registerSequelizePoolMetrics(sequelize, 'postgresql', 'user-db');

export const connectToDatabase = async () => {
  await sequelize.authenticate();
  logger.info('User database connection established successfully.');
};

export const initializeDatabase = async () => {
  await connectToDatabase();

  const syncOptions = env.NODE_ENV === 'development' ? {} : { alter: true };
  await sequelize.sync(syncOptions);
  logger.info('Database sync');
};

export const closeDatabase = async () => {
  await sequelize.close();
  logger.info('User database connection closed.');
};
