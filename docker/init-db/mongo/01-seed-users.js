// ============================================================
// Bonus seed: mirror the admin user into chat-service's Mongo
// "users" collection (chat-db / MongoDB)
// ============================================================
// Runs automatically the FIRST time the mongo container starts against
// an empty data volume (official mongo image behavior for
// /docker-entrypoint-initdb.d -- it also runs *.js files, evaluated
// with mongosh/the legacy shell, once MONGO_INITDB_ROOT_USERNAME/
// PASSWORD are set). It will NOT re-run against an existing volume --
// see docker/README.md to reset it.
//
// Not strictly required for login to work -- chat-service's own
// conversation/message queries never read this collection today, it
// only exists because chat-service consumes "user.created" RabbitMQ
// events into repositories/user.repository.ts. This script just seeds
// that same collection directly so the data mirror is complete for the
// admin user, matching services/user-service's
// publishUserCreatedEvent() payload shape exactly.
//
// Uses the same fixed id as the auth-db and user-db admin seeds.
// ============================================================

const targetDb = db.getSiblingDB('chatapp_chat_service');
const now = new Date().toISOString();

targetDb.users.updateOne(
  { _id: 'ef2493a3-0b12-4cfd-aa11-9a8d1425ac62' },
  {
    $set: {
      _id: 'ef2493a3-0b12-4cfd-aa11-9a8d1425ac62',
      email: 'admin@example.com',
      displayName: 'Admin',
      createdAt: now,
      updatedAt: now,
    },
  },
  { upsert: true },
);
