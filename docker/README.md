# docker/

Supporting files for `docker compose up`, referenced from the root
`docker-compose.yml`.

## init-db/

Each subfolder is mounted into a different database container's
`/docker-entrypoint-initdb.d`, which that image runs automatically, in
alphabetical filename order, **once** -- only the first time the
container starts against an empty data volume.

| Folder | Mounted into | Runs |
|---|---|---|
| `auth-mysql/` | `auth-db` (MySQL) | Creates `user_credentials` + `refresh_tokens`, seeds the admin login |
| `user-postgres/` | `user-db` (PostgreSQL) | Creates `users`, seeds the admin profile |
| `mongo/` | `mongo` (MongoDB) | Bonus: mirrors the admin user into chat-service's `users` collection |

### The seeded admin login

```
email:    admin@example.com
password: password123
```

This works because the **same fixed id**
(`ef2493a3-0b12-4cfd-aa11-9a8d1425ac62`) is used across all three seed
scripts -- exactly as if this user had registered through the app and
the `auth.user.registered` / `user.created` RabbitMQ events had already
propagated to user-service and chat-service. So besides logging in, the
admin also shows up correctly in `GET /users`, `/users/search`, and can
be added to conversations right away.

The password hash in `auth-mysql/02-seed-admin-user.sql` is a
pre-computed real bcrypt hash (12 salt rounds, matching
`services/auth-service/src/utils/token.ts`'s `bcrypt.hash(password, 12)`
exactly). It was generated offline since plain MySQL has no built-in
bcrypt function -- Node's `bcrypt`/`bcryptjs` verifies it exactly like
any hash it produced itself, since it's the same algorithm.

### Resetting the databases

These scripts only run once per volume. If you've already started the
stack before, editing the `.sql`/`.js` files won't do anything until you
drop the relevant volume(s):

```bash
docker compose down -v   # -v removes ALL named volumes (every DB + rabbitmq + redis)
docker compose up --build
```

To reset just one database, remove only its volume, e.g.:

```bash
docker compose down
docker volume rm chatapp-yt-main_auth-db-data
docker compose up --build
```

(Volume names are prefixed with your project's directory name --
run `docker volume ls` to see the actual names.)

## Dashboards included

| Dashboard | URL | Login |
|---|---|---|
| RabbitMQ Management | http://localhost:15672 | `guest` / `guest` |
| Redis Commander | http://localhost:8081 | `admin` / `admin123` (set via `REDIS_COMMANDER_USER`/`REDIS_COMMANDER_PASSWORD` in `.env`) |

Redis Commander is a small extra service added to `docker-compose.yml`
purely for browsing/inspecting keys (chat-service's conversation
cache) -- it isn't part of the application itself.
