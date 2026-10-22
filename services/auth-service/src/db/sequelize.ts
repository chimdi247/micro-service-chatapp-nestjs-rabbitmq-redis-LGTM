import { Sequelize } from "sequelize";
import { registerSequelizePoolMetrics } from "@chatapp/common";

import { env } from "@/config/env";
import { logger } from "@/utils/logger";

export const sequelize = new Sequelize(env.AUTH_DB_URL, {
  dialect: "mysql",
  logging:
    env.NODE_ENV === "development"
      ? (msg: unknown) => {
          logger.debug({ sequelize: msg });
        }
      : false,
  // Explicit pool sizing: connections go through ProxySQL, which multiplexes
  // them onto a smaller set of backend connections.
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

registerSequelizePoolMetrics(sequelize, "mysql", "auth-db");

export const connectToDatabase = async () => {
  await sequelize.authenticate();
  logger.info("Auth database connection established successfully.");
};

export const closeDatabase = async () => {
  await sequelize.close();
  logger.info("Auth database connection closed.");
};
