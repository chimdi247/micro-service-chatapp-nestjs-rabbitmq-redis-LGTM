-- ============================================================
-- Seed a default admin login (auth-db / MySQL)
-- ============================================================
--   email:    admin@example.com
--   password: password123
--
-- The password hash below is a real bcrypt hash (12 salt rounds --
-- the same cost factor services/auth-service/src/utils/token.ts uses
-- via bcrypt.hash(password, 12)), pre-computed since vanilla MySQL has
-- no built-in bcrypt() function to hash it at insert time. Node's
-- bcrypt/bcryptjs can verify it exactly like any hash it generated
-- itself -- the algorithm is the same regardless of which
-- implementation produced it.
--
-- The id below (a fixed UUID) is intentionally reused in
-- docker/init-db/user-postgres/02-seed-admin-user.sql and
-- docker/init-db/mongo/01-seed-users.js so the SAME user id backs the
-- login (auth-db), the profile (user-db), the search/list results
-- (user-db), and the chat-service user mirror (mongo) -- exactly as if
-- the user had registered through the app and the auth.user.registered
-- / user.created RabbitMQ events had already been consumed.
--
-- Safe to re-run: the UNIQUE KEY on email makes this a no-op if the
-- row already exists (e.g. you registered admin@example.com yourself).
-- ============================================================

USE chatapp_auth_service;

INSERT INTO user_credentials (id, email, password_hash, display_name)
VALUES (
  'ef2493a3-0b12-4cfd-aa11-9a8d1425ac62',
  'admin@example.com',
  '$2b$12$jtEpKQNb33HCXbVe5oP9/u3XGVBigk7lBYdyrMNj7P77HD3Vt/l0m',
  'Admin'
)
ON DUPLICATE KEY UPDATE email = email;
