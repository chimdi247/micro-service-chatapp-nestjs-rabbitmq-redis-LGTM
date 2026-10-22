-- ============================================================
-- User-service schema bootstrap (PostgreSQL / user-db)
-- ============================================================
-- Runs automatically the FIRST time the user-db container starts
-- against an empty data volume (official postgres image behavior for
-- /docker-entrypoint-initdb.d). It will NOT re-run against an existing
-- volume -- see docker/README.md to reset it.
--
-- Mirrors the Sequelize model in
-- services/user-service/src/db/models/user.model.ts (define:
-- { underscored: true, freezeTableName: true }, dialect: postgres).
--
-- user-service calls sequelize.sync({ alter: true }) on boot in
-- production, so column types here are matched closely to what
-- Sequelize expects (timestamptz for DataTypes.DATE) to avoid it
-- trying to alter them on every restart.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        varchar(255) NOT NULL,
  display_name varchar(255) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);
