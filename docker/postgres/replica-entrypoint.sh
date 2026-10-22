#!/bin/bash
# Bootstraps a PostgreSQL streaming replica of user-db on first start, then
# runs the stock postgres entrypoint in hot-standby mode.
set -euo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/data}"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[replica] empty data dir -> taking base backup from ${PRIMARY_HOST}"
  mkdir -p "$PGDATA"
  rm -rf "${PGDATA:?}"/* 2>/dev/null || true
  chown -R postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"

  until pg_isready -h "$PRIMARY_HOST" -p 5432 -q; do
    echo "[replica] waiting for primary..."; sleep 2
  done

  # -R writes standby.signal + primary_conninfo, so the node starts as a standby.
  gosu postgres env PGPASSWORD="$REPLICATION_PASSWORD" \
    pg_basebackup -h "$PRIMARY_HOST" -p 5432 -U "$REPLICATION_USER" \
      -D "$PGDATA" -Fp -Xs -R -P
  echo "[replica] base backup complete"
fi

exec docker-entrypoint.sh postgres -c hot_standby=on -c max_connections=200
