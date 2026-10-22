# Observability

Metrics, logs and traces for every ChatApp service and datastore, in Grafana.

```
 Node services (gateway, auth, user, chat)                 exporters / built-ins
   OpenTelemetry SDK + auto-instrumentation                 node, cAdvisor, postgres (x2), pgbouncer,
   (traces + metrics + pino logs, OTLP/HTTP)                mysqld, proxysql, redis, rabbitmq, blackbox
              |                                                      |
              v                                                      v
      OTel Collector ----> Tempo (traces) --+              Prometheus (agent mode)
              |----------> Loki  (logs)   --+--> S3 (MinIO)          |
              '----------> Mimir (metrics) <-+----------------------'  remote_write
                               ^
        Grafana  <-------------'   (Mimir + Loki + Tempo datasources, dashboards, alerts -> SMTP)
```

## Start

```bash
docker compose up --build        # whole app + data layer + observability
```

| What | URL | Login |
|---|---|---|
| Grafana | http://localhost:3001 | `admin` / `admin123` (`.env`) |
| Alert inbox (Mailpit) | http://localhost:8025 | - |
| MinIO console (buckets) | http://localhost:9001 | `minioadmin` / `minioadmin123` |
| RabbitMQ UI | http://localhost:15672 | `guest` / `guest` |

Grafana opens on **ChatApp - Overview**. Dashboards live in the *ChatApp* folder.

## Folder layout

| Path | Purpose |
|---|---|
| `mimir/mimir.yaml` | Mimir, S3 block storage (bucket `mimir-blocks`) |
| `loki/loki.yaml` | Loki 3, TSDB + chunks in S3 (bucket `loki-chunks`), native OTLP ingest |
| `tempo/tempo.yaml` | Tempo, traces in S3 (bucket `tempo-traces`), metrics-generator -> Mimir |
| `otel-collector/otel-collector.yaml` | Single OTLP entry point; fans out to Tempo / Mimir / Loki |
| `prometheus/prometheus.yml` | Agent-mode scraper for all exporters + blackbox probes |
| `blackbox/blackbox.yml` | HTTP `/health` probes (uptime SLI) |
| `postgres-exporter/queries.yaml` | Custom queries: connection saturation, replication lag |
| `rabbitmq/enabled_plugins` | Enables the built-in Prometheus plugin (:15692) |
| `grafana/provisioning/datasources` | Mimir, Loki, Tempo + cross-signal correlation |
| `grafana/provisioning/dashboards` | Dashboard provider |
| `grafana/provisioning/alerting` | Contact point (email), notification policy, alert rules |
| `grafana/dashboards/*.json` | 9 dashboards (generated, see `tools/`) |
| `tools/` | `generate_dashboards.py`, `generate_alert_rules.py` (edit + re-run) |

All of these are bind-mounted read-only into their containers by `docker-compose.yml`.

## How telemetry flows

**Instrumentation** lives in `packages/common/src/telemetry/` and is preloaded with
`node --import @chatapp/common/dist/telemetry/register.js` (see each service Dockerfile).

* **Auto-instrumentation**: HTTP server/client (so `traceparent` propagates gateway -> services),
  Express, `pg`, `mysql2`, `ioredis`, `amqplib` and more.
* **Manual instrumentation** (business logic): `auth.register`, `auth.login`, `auth.password.hash`,
  `user.sync_from_auth`, `chat.message.create`, `chat.conversation.create`, `cache.conversation.get`,
  MongoDB calls (`withDbSpan`, CLIENT spans -> service graph edge), and event publish/process spans.
* **Context propagation over RabbitMQ**: `withPublishSpan` injects W3C trace context into AMQP headers,
  `withConsumeSpan` extracts it. One registration therefore produces a single trace:
  `gateway -> auth-service -> (RabbitMQ) -> user-service -> (RabbitMQ) -> chat-service`.
  Redis calls appear as child spans in the request's trace (same process, no hop needed).
* **Structured logs**: pino writes JSON to stdout *and* to the OTel Logs API. Every line carries
  `trace_id` / `span_id`. Loki stores them as structured metadata; the Loki datasource's derived field turns
  `trace_id` into a **View trace** link (log line -> Tempo), and Tempo's trace-to-logs links back.
* **Metrics**: `chatapp_http_server_requests|duration|active_requests`, business KPIs
  (`chatapp_users_registered`, `chatapp_auth_logins{outcome}`, `chatapp_messages_sent`,
  `chatapp_conversations_created`, `chatapp_cache_requests{result}`, `chatapp_events_*`),
  runtime (`chatapp_process_*`) and connection pools (`chatapp_db_pool_*`).
  Names are kept exactly as defined in code (`add_metric_suffixes: false` in the collector).

## Dashboards

| Dashboard | Highlights |
|---|---|
| Overview (SLI / SLO / KPI) | Uptime, availability SLI, error budget, latency-SLO attainment, successful vs failed requests (2xx/3xx, 4xx, 5xx), RED, p50/p95/p99, business KPIs, error logs |
| Service drill-down | Per-route RED, runtime health, pools, **service map**, error/slow traces, **logs with trace links** |
| Infrastructure | Node + container CPU / memory (% of limit, 40% threshold lines), network, restarts, pipeline health |
| PostgreSQL & PgBouncer | Replication lag, TPS, % max connections, active connections; PgBouncer clients/servers/waiting |
| MySQL & ProxySQL | Connections, QPS; ProxySQL client/backend pools |
| Redis | Connected clients, cache hit ratio, command throughput, memory % |
| Connection pools | MongoDB driver pool (client conns, server conns, waiting, % in use) + Sequelize pools |
| RabbitMQ | Ready / unacked messages, publish & ack rates, per-queue depth, app-level event KPIs |
| k6 load tests | Live test results next to server-side latency/CPU |

## Alerts (Grafana-managed, email)

Provisioned from `grafana/provisioning/alerting/` into the **ChatApp Alerts** folder:

* **Node CPU > 40%**, **Node memory > 40%**
* **Container CPU > 40% of its limit**, **Container memory > 40% of its limit**
  (limits are set on the app services, client and Redis via `deploy.resources.limits`; containers without a
  limit are covered by the node alerts)
* Service health probe failing, 5xx rate > 5%, p95 latency > 1s
* RabbitMQ backlog, PostgreSQL connections / replication lag, MongoDB pool saturation, Redis memory

Emails go through Grafana's SMTP settings (`GF_SMTP_*` in compose). By default they land in **Mailpit**
(http://localhost:8025). For real delivery set in `.env`:

```
SMTP_HOST=smtp.example.com   SMTP_PORT=587   SMTP_USER=...   SMTP_PASSWORD=...
SMTP_FROM_ADDRESS=alerts@yourdomain.com   SMTP_STARTTLS_POLICY=MandatoryStartTLS   SMTP_SKIP_VERIFY=false
ALERT_EMAIL_TO=team@yourdomain.com
```

Trigger an alert on demand: `docker compose --profile tests run --rm k6 run /scripts/alert-trigger.js`
(login is bcrypt-bound, so auth-service passes 40% of its CPU limit within a minute or two).

## Using real S3 instead of MinIO

Mimir, Loki and Tempo read `S3_*` from the environment. For AWS S3: create the five buckets, then in `.env`

```
S3_ENDPOINT=s3.eu-west-1.amazonaws.com     S3_REGION=eu-west-1     S3_INSECURE=false
S3_ACCESS_KEY=...   S3_SECRET_KEY=...     (or use an instance/IRSA role and drop the keys from the configs)
```

and remove `minio`, `minio-init` (and their `depends_on`) from `docker-compose.yml`.
MinIO's console (`:9001`) lets you browse the buckets to confirm data is persisted.

## Persistence

* Object data (blocks, chunks, traces): S3 buckets (MinIO volume `minio-data`).
* WAL / local state: named volumes `mimir-data`, `loki-data`, `tempo-data`; Grafana state: `grafana-data`.
* `docker compose down` keeps everything; `docker compose down -v` wipes it.

## Verify it works

1. `docker compose up --build`, wait ~1 min, open http://localhost:3000, register two users, chat.
2. Grafana -> *Overview*: request rate and KPIs move. *Service drill-down* -> pick `auth-service` -> open a log line
   -> **View trace** -> the trace continues through RabbitMQ into `user-service` and `chat-service`.
3. Automated check: `cd tests && pnpm i && pnpm test:observability`.
4. Grafana -> Alerting -> Alert rules: 12 rules in 3 groups.

## Known limitations (read before relying on it)

* **This stack was authored without being able to run Docker or fetch packages**, so it has not been
  booted end to end. Expect small first-run fixes (image tags, metric-name drift). Start with
  `docker compose up minio minio-init mimir loki tempo otel-collector grafana` and check `docker compose logs`.
* **Lockfile**: `@chatapp/common` gained OpenTelemetry dependencies, so Dockerfiles use
  `pnpm install --no-frozen-lockfile`. Run `pnpm install` once, commit `pnpm-lock.yaml`, then switch back
  to `--frozen-lockfile`.
* **Exporter metric names** (ProxySQL, PgBouncer, postgres_exporter, RabbitMQ) vary by version. If a panel is
  empty, check the raw metric (`http://localhost:6070/metrics` for ProxySQL) and adjust
  `tools/generate_dashboards.py`. PostgreSQL connection/replication metrics come from
  `postgres-exporter/queries.yaml`, whose names are fixed.
* **MinIO**: upstream stopped publishing new community images; the compose file pins an older release tag
  (`MINIO_IMAGE_TAG`). Any S3-compatible store works.
* **cAdvisor / node-exporter** need Linux. On Docker Desktop they report the VM, and per-container
  names may be missing, which affects the container CPU/memory panels and alerts.
* PostgreSQL replication-lag and the replica only bootstrap on a **fresh** `user-db-data` volume
  (`docker compose down -v` once if you already had data).
* MongoDB auto-instrumentation is disabled on purpose (driver v7); spans come from `withDbSpan`.
* OTLP metric counters appear only after the first event, so some KPI panels are empty until traffic exists.
