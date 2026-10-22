-- ============================================================
-- Auth-service schema bootstrap (MySQL / auth-db)
-- ============================================================
-- Runs automatically the FIRST time the auth-db container starts
-- against an empty data volume (official mysql image behavior for
-- /docker-entrypoint-initdb.d). It will NOT re-run against an existing
-- volume -- see docker/README.md to reset it.
--
-- Mirrors the Sequelize models in
-- services/auth-service/src/models/*.ts (define: { underscored: true,
-- freezeTableName: true }, dialect: mysql). auth-service also calls
-- sequelize.sync() on boot, which will happily find these tables
-- already present and leave them alone.
--
-- NOTE: this assumes the default database name from .env.example
-- (chatapp_auth_service). If you changed AUTH_DB_NAME, update the
-- USE statement below to match.
-- ============================================================

USE chatapp_auth_service;

CREATE TABLE IF NOT EXISTS user_credentials (
  id            CHAR(36)      NOT NULL PRIMARY KEY,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  display_name  VARCHAR(255)  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY user_credentials_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         CHAR(36)  NOT NULL PRIMARY KEY,
  user_id    CHAR(36)  NOT NULL,
  token_id   CHAR(36)  NOT NULL,
  expires_at DATETIME  NOT NULL,
  created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY refresh_tokens_user_id_idx (user_id),
  CONSTRAINT refresh_tokens_user_id_fk FOREIGN KEY (user_id)
    REFERENCES user_credentials (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
