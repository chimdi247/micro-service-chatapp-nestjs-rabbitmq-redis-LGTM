-- ============================================================
-- Seed the admin user's profile (user-db / PostgreSQL)
-- ============================================================
-- Same id as docker/init-db/auth-mysql/02-seed-admin-user.sql so this
-- profile row is the one GET /users/:id (via the gateway) returns for
-- the admin@example.com login, and so the admin shows up correctly in
-- GET /users and /users/search for other users to start a
-- conversation with.
--
-- Safe to re-run: ON CONFLICT skips the insert if the email already
-- exists.
-- ============================================================

INSERT INTO users (id, email, display_name)
VALUES (
  'ef2493a3-0b12-4cfd-aa11-9a8d1425ac62',
  'admin@example.com',
  'Admin'
)
ON CONFLICT (email) DO NOTHING;
