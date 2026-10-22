#!/bin/bash
# Runs once on first boot of the PRIMARY: creates the replication role and lets
# it connect for streaming replication (used by user-db-replica).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE ${REPLICATION_USER:-replicator} WITH REPLICATION LOGIN PASSWORD '${REPLICATION_PASSWORD:-replicator_password}';
EOSQL

echo "host replication ${REPLICATION_USER:-replicator} all scram-sha-256" >> "$PGDATA/pg_hba.conf"
