#!/usr/bin/env python3
"""Generates grafana/dashboards/*.json.  Run: python3 observability/tools/generate_dashboards.py
(Dashboards are normal provisioned JSON; you may also edit them in the Grafana UI.)"""
import json
import pathlib

from dashlib import *  # noqa: F401,F403

OUT = pathlib.Path(__file__).resolve().parents[1] / "grafana/dashboards"
OUT.mkdir(parents=True, exist_ok=True)


def save(d):
    (OUT / f"{d.uid}.json").write_text(json.dumps(d.build(), indent=2) + "\n")
    print("wrote", d.uid, f"({len([p for p in d.panels if p['type'] != 'row'])} panels)")


# Reusable selectors ------------------------------------------------------------
REQ = 'chatapp_http_server_requests{job=~"$service"}'
REQ5 = 'chatapp_http_server_requests{job=~"$service",http_status_code=~"5.."}'
BUCKET = 'chatapp_http_server_duration_bucket{job=~"$service"}'
RI = "$__rate_interval"
OK_UP = [{"type": "value", "options": {"1": {"text": "UP", "color": "green"}, "0": {"text": "DOWN", "color": "red"}}}]

# =============================================================================
# 1. Overview: SLI / SLO / KPI
# =============================================================================
d = Dash("chatapp-overview", "ChatApp - Overview (SLI / SLO / KPI)", ["overview", "slo"],
         description="Golden signals, SLO attainment, error budget and business KPIs for every ChatApp service.")
d.var_query("service", "label_values(chatapp_http_server_requests, job)", "Service")
d.var_text("slo_availability", "99.5", "Availability SLO (%)")
d.var_custom("slo_latency", "0.1,0.25,0.5,1,2.5", "0.5", "Latency SLO threshold (s)")

d.row("Service health & SLOs")
d.stat("Services UP", ['100 * sum(probe_success{job="blackbox-http"}) / count(probe_success{job="blackbox-http"})'], unit="percent",
       thresholds=steps((RED, None), (YELLOW, 99), (GREEN, 100)), decimals=0, description="Share of /health probes currently succeeding (blackbox exporter).")
d.stat("Uptime (selected range)", ['100 * avg(avg_over_time(probe_success{job="blackbox-http",service=~"$service"}[$__range]))'], unit="percent",
       thresholds=steps((RED, None), (YELLOW, 99), (GREEN, 99.9)), decimals=3, description="Uptime SLI from synthetic health probes.")
d.stat("Availability SLI", [f'100 * (1 - (sum(increase({REQ5}[$__range])) or vector(0)) / sum(increase({REQ}[$__range])))'], unit="percent",
       thresholds=steps((RED, None), (YELLOW, 99), (GREEN, 99.5)), decimals=3, description="Share of requests that did not fail with 5xx.")
d.stat("Error budget remaining", [f'clamp_min(100 * (1 - ((sum(increase({REQ5}[$__range])) or vector(0)) / sum(increase({REQ}[$__range]))) / ((100 - $slo_availability) / 100)), 0)'],
       unit="percent", thresholds=steps((RED, None), (YELLOW, 25), (GREEN, 50)), decimals=1, description="100% = no errors; 0% = SLO breached for the selected range.")
d.stat("Latency SLO attainment", [f'100 * sum(increase(chatapp_http_server_duration_bucket{{job=~"$service",le="$slo_latency"}}[$__range])) / sum(increase(chatapp_http_server_duration_count{{job=~"$service"}}[$__range]))'],
       unit="percent", thresholds=steps((RED, None), (YELLOW, 95), (GREEN, 99)), decimals=2, description="Share of requests faster than the SLO latency threshold.")
d.stat("Requests / sec", [f'sum(rate({REQ}[{RI}]))'], unit="reqps", decimals=2)

d.row("Successful vs failed HTTP requests")
d.stat("Successful (2xx/3xx)", [f'sum(increase(chatapp_http_server_requests{{job=~"$service",http_status_code=~"[23].."}}[$__range])) or vector(0)'],
       w=4, unit="short", thresholds=steps((GREEN, None)), graph=False, decimals=0)
d.stat("Client errors (4xx)", [f'sum(increase(chatapp_http_server_requests{{job=~"$service",http_status_code=~"4.."}}[$__range])) or vector(0)'],
       w=4, unit="short", thresholds=steps((BLUE, None)), graph=False, decimals=0)
d.stat("Failed (5xx)", [f'sum(increase({REQ5}[$__range])) or vector(0)'],
       w=4, unit="short", thresholds=steps((GREEN, None), (RED, 1)), graph=False, decimals=0)
d.ts("Requests by status class", [
    (f'sum(rate(chatapp_http_server_requests{{job=~"$service",http_status_code=~"2.."}}[{RI}]))', "2xx"),
    (f'sum(rate(chatapp_http_server_requests{{job=~"$service",http_status_code=~"3.."}}[{RI}]))', "3xx"),
    (f'sum(rate(chatapp_http_server_requests{{job=~"$service",http_status_code=~"4.."}}[{RI}]))', "4xx"),
    (f'sum(rate({REQ5}[{RI}]))', "5xx")], w=12, unit="reqps", stack=True,
    overrides=[{"matcher": {"id": "byName", "options": "5xx"}, "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": "red"}}]},
               {"matcher": {"id": "byName", "options": "4xx"}, "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": "orange"}}]},
               {"matcher": {"id": "byName", "options": "2xx"}, "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": "green"}}]}])

d.row("RED: rate, errors, duration")
d.ts("Request rate by service", [(f'sum by (job) (rate({REQ}[{RI}]))', "{{job}}")], unit="reqps")
d.ts("Error rate (5xx %) by service", [(f'100 * sum by (job) (rate({REQ5}[{RI}])) / sum by (job) (rate({REQ}[{RI}]))', "{{job}}")],
     unit="percent", thresholds=steps((GREEN, None), (RED, 5)), threshold_style="line")
d.ts("Latency percentiles (all selected services)", [
    (f'histogram_quantile(0.50, sum by (le) (rate({BUCKET}[{RI}])))', "p50"),
    (f'histogram_quantile(0.95, sum by (le) (rate({BUCKET}[{RI}])))', "p95"),
    (f'histogram_quantile(0.99, sum by (le) (rate({BUCKET}[{RI}])))', "p99")], unit="s")
d.ts("p95 latency by service", [(f'histogram_quantile(0.95, sum by (le, job) (rate({BUCKET}[{RI}])))', "{{job}}")], unit="s",
     thresholds=steps((GREEN, None), (RED, 1)), threshold_style="line")
d.table("Slowest routes (p95)", [f'topk(10, histogram_quantile(0.95, sum by (le, job, http_method, http_route) (rate({BUCKET}[$__range]))))'],
        unit="s", sort_by="Value", transformations=[{"id": "organize", "options": {"excludeByName": {"Time": True}, "renameByName": {"Value": "p95"}}}])
d.table("Routes with most 5xx", [f'topk(10, sum by (job, http_method, http_route) (increase({REQ5}[$__range])) > 0)'],
        unit="short", sort_by="Value", transformations=[{"id": "organize", "options": {"excludeByName": {"Time": True}, "renameByName": {"Value": "5xx count"}}}])

d.row("Business KPIs")
d.stat("Users registered", ['sum(increase(chatapp_users_registered[$__range])) or vector(0)'], w=4, graph=False, decimals=0, thresholds=steps((BLUE, None)))
d.stat("Messages sent", ['sum(increase(chatapp_messages_sent[$__range])) or vector(0)'], w=4, graph=False, decimals=0, thresholds=steps((BLUE, None)))
d.stat("Conversations created", ['sum(increase(chatapp_conversations_created[$__range])) or vector(0)'], w=4, graph=False, decimals=0, thresholds=steps((BLUE, None)))
d.stat("Login success rate", ['100 * sum(increase(chatapp_auth_logins{outcome="success"}[$__range])) / sum(increase(chatapp_auth_logins[$__range]))'],
       w=4, unit="percent", decimals=1, thresholds=steps((RED, None), (YELLOW, 80), (GREEN, 95)))
d.stat("Conversation cache hit ratio", ['100 * sum(increase(chatapp_cache_requests{result="hit"}[$__range])) / sum(increase(chatapp_cache_requests[$__range]))'],
       w=4, unit="percent", decimals=1, thresholds=steps((RED, None), (YELLOW, 50), (GREEN, 80)))
d.stat("Events failed to process", ['sum(increase(chatapp_events_consumed{outcome="failure"}[$__range])) or vector(0)'],
       w=4, graph=False, decimals=0, thresholds=steps((GREEN, None), (RED, 1)))
d.ts("Messages sent per minute", ['60 * sum(rate(chatapp_messages_sent[$__rate_interval]))'], w=8, unit="short")
d.ts("Logins by outcome (per min)", [('60 * sum by (outcome) (rate(chatapp_auth_logins[$__rate_interval]))', "{{outcome}}")], w=8, unit="short", stack=True)
d.ts("Registrations & conversations (per min)", [
    ('60 * sum(rate(chatapp_users_registered[$__rate_interval]))', "registrations"),
    ('60 * sum(rate(chatapp_conversations_created[$__rate_interval]))', "conversations")], w=8, unit="short")
d.ts("Domain events published / consumed (per sec)", [
    ('sum by (messaging_rabbitmq_destination_routing_key) (rate(chatapp_events_published[$__rate_interval]))', "published {{messaging_rabbitmq_destination_routing_key}}"),
    ('sum by (queue, outcome) (rate(chatapp_events_consumed[$__rate_interval]))', "consumed {{queue}} ({{outcome}})")], w=12, unit="ops")
d.ts("Event processing p95", [('histogram_quantile(0.95, sum by (le, queue) (rate(chatapp_events_processing_duration_bucket[$__rate_interval])))', "{{queue}}")], w=12, unit="s")

d.row("Recent error logs (click a line -> View trace)")
d.logs("Errors & warnings across all services", '{service_name=~".+"} | detected_level=~"error|warn"', h=10)
save(d)

# =============================================================================
# 2. Service drill-down
# =============================================================================
d = Dash("chatapp-service-detail", "ChatApp - Service drill-down (metrics, logs, traces)", ["service", "tracing", "logs"],
         description="One service: RED metrics, runtime health, pools, service map, error/slow traces and correlated logs.")
d.var_query("service", "label_values(chatapp_http_server_requests, job)", "Service", multi=False, include_all=False)
d.var_custom("level", ".*,error,warn,info,debug", ".*", "Log level")
d.var_text("search", "", "Log text filter")
S = 'job="$service"'

d.row("Golden signals")
d.stat("Req/s", [f'sum(rate(chatapp_http_server_requests{{{S}}}[{RI}]))'], w=3, unit="reqps", decimals=2)
d.stat("5xx %", [f'100 * (sum(rate(chatapp_http_server_requests{{{S},http_status_code=~"5.."}}[{RI}])) or vector(0)) / sum(rate(chatapp_http_server_requests{{{S}}}[{RI}]))'],
       w=3, unit="percent", decimals=2, thresholds=steps((GREEN, None), (YELLOW, 1), (RED, 5)))
d.stat("p95 latency", [f'histogram_quantile(0.95, sum by (le) (rate(chatapp_http_server_duration_bucket{{{S}}}[{RI}])))'], w=3, unit="s",
       thresholds=steps((GREEN, None), (YELLOW, 0.5), (RED, 1)))
d.stat("In-flight requests", [f'sum(chatapp_http_server_active_requests{{{S}}})'], w=3, decimals=0)
d.stat("Instances reporting", [f'count(chatapp_process_uptime{{{S}}})'], w=3, decimals=0)
d.stat("Uptime", [f'max(chatapp_process_uptime{{{S}}})'], w=3, unit="s")
d.stat("Health probe", [f'min(probe_success{{job="blackbox-http",service="$service"}})'], w=3, mappings=OK_UP, thresholds=steps((RED, None), (GREEN, 1)), graph=False)
d.stat("Event-loop lag p99", [f'max(chatapp_process_eventloop_delay_p99{{{S}}})'], w=3, unit="s", thresholds=steps((GREEN, None), (YELLOW, 0.1), (RED, 0.5)))

d.row("Routes")
d.ts("Rate by route", [(f'sum by (http_method, http_route) (rate(chatapp_http_server_requests{{{S}}}[{RI}]))', "{{http_method}} {{http_route}}")], unit="reqps")
d.ts("p95 by route", [(f'histogram_quantile(0.95, sum by (le, http_method, http_route) (rate(chatapp_http_server_duration_bucket{{{S}}}[{RI}])))', "{{http_method}} {{http_route}}")], unit="s")
d.ts("Status codes", [(f'sum by (http_status_code) (rate(chatapp_http_server_requests{{{S}}}[{RI}]))', "{{http_status_code}}")], unit="reqps", stack=True)
d.ts("Latency percentiles", [
    (f'histogram_quantile(0.50, sum by (le) (rate(chatapp_http_server_duration_bucket{{{S}}}[{RI}])))', "p50"),
    (f'histogram_quantile(0.95, sum by (le) (rate(chatapp_http_server_duration_bucket{{{S}}}[{RI}])))', "p95"),
    (f'histogram_quantile(0.99, sum by (le) (rate(chatapp_http_server_duration_bucket{{{S}}}[{RI}])))', "p99")], unit="s")

d.row("Runtime & connection pools")
d.ts("Process memory", [(f'chatapp_process_memory_rss{{{S}}}', "rss {{instance}}"), (f'chatapp_process_memory_heap_used{{{S}}}', "heap {{instance}}")], w=8, unit="bytes")
d.ts("Process CPU (fraction of a core)", [(f'chatapp_process_cpu_utilization{{{S}}}', "{{instance}}")], w=8, unit="percentunit")
d.ts("DB pool: in use / max", [(f'chatapp_db_pool_connections{{{S},state="in_use"}}', "in use {{db_system}}"),
                               (f'chatapp_db_pool_max_connections{{{S}}}', "max {{db_system}}"),
                               (f'chatapp_db_pool_pending_requests{{{S}}}', "waiting {{db_system}}")], w=8)

d.row("Traces (Tempo)")
d.nodegraph("Service map (from spans)", w=12, h=10)
d.ts("Span rate by operation (Tempo span-metrics)", [(f'sum by (span_name) (rate(traces_spanmetrics_calls_total{{service="$service"}}[{RI}]))', "{{span_name}}")], w=12, h=10, unit="ops")
d.traces("Error traces", '{ resource.service.name = "$service" && status = error }', w=12)
d.traces("Slow traces (>500ms)", '{ resource.service.name = "$service" && duration > 500ms }', w=12)

d.row("Logs (Loki) - open a line, click 'View trace' to jump to its spans")
d.logs("Service logs", '{service_name="$service"} | detected_level=~"$level" |~ "(?i)$search"', h=12)
save(d)

# =============================================================================
# 3. Infrastructure: nodes + containers
# =============================================================================
d = Dash("chatapp-infrastructure", "ChatApp - Infrastructure (nodes & containers)", ["infra", "cpu", "memory"],
         description="Host and per-container CPU/memory/network. Alerts fire when CPU or memory exceeds 40%.")
d.var_query("container", 'label_values(container_last_seen{name=~"chatapp-.+"}, name)', "Container")
C = 'name=~"$container"'
thr40 = steps((GREEN, None), (YELLOW, 30), (RED, 40))

d.row("Node (host)")
d.gauge("Node CPU %", ['100 - avg(rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100'], thresholds=thr40, description="Alert threshold: 40%")
d.gauge("Node memory %", ['100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)'], thresholds=thr40, description="Alert threshold: 40%")
d.gauge("Root disk used %", ['100 * (1 - node_filesystem_avail_bytes{mountpoint="/",fstype!="rootfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="rootfs"})'],
        thresholds=steps((GREEN, None), (YELLOW, 70), (RED, 85)))
d.stat("Load (1m)", ['node_load1'], w=3, decimals=2)
d.stat("Node uptime", ['time() - node_boot_time_seconds'], w=5, unit="s")
d.ts("Node CPU by mode", [('100 * avg by (mode) (rate(node_cpu_seconds_total[2m]))', "{{mode}}")], unit="percent", stack=True, maxv=100)
d.ts("Node memory", [('node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes', "used"), ('node_memory_MemAvailable_bytes', "available")], unit="bytes", stack=True)
d.ts("Node network (bytes/s)", [('sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[2m]))', "rx"),
                                ('sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*|docker.*|br-.*"}[2m]))', "tx")], unit="Bps")
d.ts("Node disk I/O (bytes/s)", [('sum(rate(node_disk_read_bytes_total[2m]))', "read"), ('sum(rate(node_disk_written_bytes_total[2m]))', "write")], unit="Bps")

d.row("Containers - CPU")
d.ts("Container CPU % of its limit (alert > 40%)", [(f'100 * sum by (name) (rate(container_cpu_usage_seconds_total{{{C}}}[{RI}])) / max by (name) (container_spec_cpu_quota{{{C}}} / container_spec_cpu_period{{{C}}} > 0)', "{{name}}")],
     unit="percent", thresholds=thr40, threshold_style="line", description="Only containers that have a CPU limit (docker-compose deploy.resources.limits).")
d.ts("Container CPU (cores used)", [(f'sum by (name) (rate(container_cpu_usage_seconds_total{{{C}}}[{RI}]))', "{{name}}")], unit="short")
d.row("Containers - memory")
d.ts("Container memory % of its limit (alert > 40%)", [(f'100 * max by (name) (container_memory_working_set_bytes{{{C}}}) / max by (name) (container_spec_memory_limit_bytes{{{C}}} > 0)', "{{name}}")],
     unit="percent", thresholds=thr40, threshold_style="line")
d.ts("Container memory working set", [(f'max by (name) (container_memory_working_set_bytes{{{C}}})', "{{name}}")], unit="bytes")
d.row("Containers - network, restarts, uptime")
d.ts("Network receive (bytes/s)", [(f'sum by (name) (rate(container_network_receive_bytes_total{{{C}}}[{RI}]))', "{{name}}")], w=8, unit="Bps")
d.ts("Network transmit (bytes/s)", [(f'sum by (name) (rate(container_network_transmit_bytes_total{{{C}}}[{RI}]))', "{{name}}")], w=8, unit="Bps")
d.ts("Restarts / OOM kills (1h)", [(f'changes(container_start_time_seconds{{{C}}}[1h])', "restarts {{name}}"), (f'increase(container_oom_events_total{{{C}}}[1h])', "oom {{name}}")], w=8)
d.table("Container summary", [
    f'max by (name) (time() - container_start_time_seconds{{{C}}})',
    f'100 * max by (name) (container_memory_working_set_bytes{{{C}}}) / max by (name) (container_spec_memory_limit_bytes{{{C}}} > 0)',
    f'100 * sum by (name) (rate(container_cpu_usage_seconds_total{{{C}}}[2m])) / max by (name) (container_spec_cpu_quota{{{C}}} / container_spec_cpu_period{{{C}}} > 0)'],
    w=24, h=9, transformations=[
        {"id": "joinByField", "options": {"byField": "name", "mode": "outer"}},
        {"id": "organize", "options": {"excludeByName": {"Time 1": True, "Time 2": True, "Time 3": True},
                                      "renameByName": {"Value #A": "Uptime (s)", "Value #B": "Mem % of limit", "Value #C": "CPU % of limit"}}}])

d.row("Telemetry pipeline health")
d.stat("Targets up", ['sum(up)'], w=4, decimals=0, thresholds=steps((GREEN, None)))
d.stat("Targets down", ['count(up == 0) or vector(0)'], w=4, decimals=0, thresholds=steps((GREEN, None), (RED, 1)), graph=False)
d.ts("Collector: accepted telemetry/s", [('sum by (__name__) (rate({__name__=~"otelcol_receiver_accepted_.+"}[2m]))', "{{__name__}}")], w=8, unit="ops")
d.ts("Collector: refused / failed exports/s", [('sum by (__name__) (rate({__name__=~"otelcol_(receiver_refused|exporter_send_failed)_.+"}[2m]))', "{{__name__}}")], w=8, unit="ops")
save(d)

# =============================================================================
# 4. PostgreSQL + PgBouncer
# =============================================================================
d = Dash("chatapp-postgres", "ChatApp - PostgreSQL & PgBouncer", ["postgres", "pgbouncer", "database"],
         description="user-service database: replication lag, TPS, connection saturation and PgBouncer pool health.")
P = 'job="postgres-primary"'
DB = 'datname="chatapp_user_service"'
d.row("PostgreSQL (primary)")
d.stat("Replication lag (replay)", ['max(pg_replication_stat_replay_lag_seconds) or vector(0)'], w=4, unit="s", decimals=3,
       thresholds=steps((GREEN, None), (YELLOW, 5), (RED, 30)), description="Max replay lag across standbys, measured on the primary.")
d.stat("Standbys connected", ['count(pg_replication_stat_lag_bytes) or vector(0)'], w=4, decimals=0, thresholds=steps((RED, None), (GREEN, 1)), graph=False)
d.stat("Transactions / sec", [f'sum(rate(pg_stat_database_xact_commit{{{P},{DB}}}[{RI}]) + rate(pg_stat_database_xact_rollback{{{P},{DB}}}[{RI}]))'], w=4, unit="ops", decimals=2)
d.gauge("% of max connections in use", [f'100 * pg_connections_total{{{P}}} / pg_connections_max{{{P}}}'], w=4, thresholds=steps((GREEN, None), (YELLOW, 60), (RED, 80)))
d.stat("Active connections", [f'pg_connections_active{{{P}}}'], w=4, decimals=0)
d.stat("Cache hit ratio", [f'100 * sum(rate(pg_stat_database_blks_hit{{{P},{DB}}}[{RI}])) / (sum(rate(pg_stat_database_blks_hit{{{P},{DB}}}[{RI}])) + sum(rate(pg_stat_database_blks_read{{{P},{DB}}}[{RI}])))'],
       w=4, unit="percent", decimals=2, thresholds=steps((RED, None), (YELLOW, 90), (GREEN, 99)))
d.ts("Replication lag (seconds)", [('pg_replication_stat_write_lag_seconds', "write {{application_name}}"), ('pg_replication_stat_flush_lag_seconds', "flush {{application_name}}"),
                                   ('pg_replication_stat_replay_lag_seconds', "replay {{application_name}}")], unit="s")
d.ts("Replication lag (bytes behind primary)", [('pg_replication_stat_lag_bytes', "{{application_name}}")], unit="bytes")
d.ts("Transactions per second", [(f'sum(rate(pg_stat_database_xact_commit{{{P},{DB}}}[{RI}]))', "commits"), (f'sum(rate(pg_stat_database_xact_rollback{{{P},{DB}}}[{RI}]))', "rollbacks")], unit="ops")
d.ts("Connections", [(f'pg_connections_active{{{P}}}', "active"), (f'pg_connections_idle{{{P}}}', "idle"),
                     (f'pg_connections_idle_in_transaction{{{P}}}', "idle in transaction"), (f'pg_connections_max{{{P}}}', "max_connections")], unit="short")
d.ts("% of max connections in use", [(f'100 * pg_connections_total{{{P}}} / pg_connections_max{{{P}}}', "in use %")], unit="percent", thresholds=steps((GREEN, None), (RED, 80)), threshold_style="line")
d.ts("Row operations / sec", [(f'sum(rate(pg_stat_database_tup_inserted{{{P},{DB}}}[{RI}]))', "inserted"), (f'sum(rate(pg_stat_database_tup_updated{{{P},{DB}}}[{RI}]))', "updated"),
                              (f'sum(rate(pg_stat_database_tup_deleted{{{P},{DB}}}[{RI}]))', "deleted"), (f'sum(rate(pg_stat_database_tup_fetched{{{P},{DB}}}[{RI}]))', "fetched")], unit="ops")
d.ts("Deadlocks & conflicts / min", [(f'60 * sum(rate(pg_stat_database_deadlocks{{{P},{DB}}}[{RI}]))', "deadlocks"), (f'60 * sum(rate(pg_stat_database_conflicts{{{P},{DB}}}[{RI}]))', "conflicts")], unit="short")
d.row("PgBouncer (connection pooler in front of user-db)")
d.stat("Clients active", ['sum(pgbouncer_pools_client_active_connections)'], w=4, decimals=0)
d.stat("Clients waiting", ['sum(pgbouncer_pools_client_waiting_connections)'], w=4, decimals=0, thresholds=steps((GREEN, None), (YELLOW, 1), (RED, 10)))
d.stat("Server conns active", ['sum(pgbouncer_pools_server_active_connections)'], w=4, decimals=0)
d.stat("Server conns idle", ['sum(pgbouncer_pools_server_idle_connections)'], w=4, decimals=0)
d.stat("Max client wait", ['max(pgbouncer_pools_client_maxwait_seconds)'], w=4, unit="s", thresholds=steps((GREEN, None), (YELLOW, 0.1), (RED, 1)))
d.stat("Queries / sec", ['sum(rate(pgbouncer_stats_queries_pooled_total[$__rate_interval]))'], w=4, unit="ops", decimals=1)
d.ts("Client connections", [('sum by (database) (pgbouncer_pools_client_active_connections)', "active {{database}}"), ('sum by (database) (pgbouncer_pools_client_waiting_connections)', "waiting {{database}}")])
d.ts("Server connections", [('sum by (database) (pgbouncer_pools_server_active_connections)', "active {{database}}"), ('sum by (database) (pgbouncer_pools_server_idle_connections)', "idle {{database}}"),
                            ('sum by (database) (pgbouncer_pools_server_used_connections)', "used {{database}}")])
d.ts("Pool usage % (active server conns / pool_size)", [('100 * sum(pgbouncer_pools_server_active_connections) / sum(pgbouncer_databases_pool_size)', "pool in use %")], unit="percent",
     thresholds=steps((GREEN, None), (RED, 80)), threshold_style="line")
d.ts("PgBouncer traffic", [('sum(rate(pgbouncer_stats_received_bytes_total[$__rate_interval]))', "received"), ('sum(rate(pgbouncer_stats_sent_bytes_total[$__rate_interval]))', "sent")], unit="Bps")
save(d)

# =============================================================================
# 5. MySQL + ProxySQL
# =============================================================================
d = Dash("chatapp-mysql", "ChatApp - MySQL & ProxySQL", ["mysql", "proxysql", "database"],
         description="auth-service database behind ProxySQL. ProxySQL metric names are version dependent: verify at http://localhost:6070/metrics.")
d.row("MySQL (auth-db)")
d.stat("Threads connected", ['mysql_global_status_threads_connected'], w=4, decimals=0)
d.stat("Threads running", ['mysql_global_status_threads_running'], w=4, decimals=0)
d.gauge("% of max_connections", ['100 * mysql_global_status_threads_connected / mysql_global_variables_max_connections'], w=4, thresholds=steps((GREEN, None), (YELLOW, 60), (RED, 80)))
d.stat("Queries / sec", ['rate(mysql_global_status_queries[$__rate_interval])'], w=4, unit="ops", decimals=1)
d.stat("Slow queries / min", ['60 * rate(mysql_global_status_slow_queries[$__rate_interval])'], w=4, decimals=2)
d.stat("Aborted connects / min", ['60 * rate(mysql_global_status_aborted_connects[$__rate_interval])'], w=4, decimals=2, thresholds=steps((GREEN, None), (RED, 1)))
d.ts("Connections", [('mysql_global_status_threads_connected', "connected"), ('mysql_global_status_threads_running', "running"), ('mysql_global_variables_max_connections', "max")])
d.ts("Commands / sec", [('sum by (command) (rate(mysql_global_status_commands_total{command=~"select|insert|update|delete|commit|rollback"}[$__rate_interval]))', "{{command}}")], unit="ops")
d.ts("Network traffic", [('rate(mysql_global_status_bytes_received[$__rate_interval])', "received"), ('rate(mysql_global_status_bytes_sent[$__rate_interval])', "sent")], unit="Bps")
d.ts("InnoDB buffer pool hit ratio", [('100 * (1 - rate(mysql_global_status_innodb_buffer_pool_reads[$__rate_interval]) / rate(mysql_global_status_innodb_buffer_pool_read_requests[$__rate_interval]))', "hit %")], unit="percent")
d.row("ProxySQL (connection pooler in front of auth-db)")
d.stat("Client connections", ['sum(proxysql_client_connections_connected)'], w=4, decimals=0)
d.stat("Backend conns in use", ['sum(proxysql_connpool_conn_used)'], w=4, decimals=0)
d.stat("Backend conns free", ['sum(proxysql_connpool_conn_free)'], w=4, decimals=0)
d.gauge("Backend pool in use %", ['100 * sum(proxysql_connpool_conn_used) / (sum(proxysql_connpool_conn_used) + sum(proxysql_connpool_conn_free))'], w=4, thresholds=steps((GREEN, None), (YELLOW, 60), (RED, 80)))
d.stat("Queries / sec", ['sum(rate(proxysql_questions_total[$__rate_interval]))'], w=4, unit="ops", decimals=1)
d.stat("Backend conn errors / min", ['60 * sum(rate(proxysql_connpool_conn_err_total[$__rate_interval]))'], w=4, decimals=2, thresholds=steps((GREEN, None), (RED, 1)))
d.ts("Client connections", [('sum(proxysql_client_connections_connected)', "connected"), ('sum(proxysql_client_connections_non_idle)', "non-idle")])
d.ts("Backend connection pool", [('sum by (endpoint) (proxysql_connpool_conn_used)', "used {{endpoint}}"), ('sum by (endpoint) (proxysql_connpool_conn_free)', "free {{endpoint}}")])
d.ts("Queries & slow queries / sec", [('sum(rate(proxysql_questions_total[$__rate_interval]))', "queries"), ('sum(rate(proxysql_slow_queries_total[$__rate_interval]))', "slow")], unit="ops")
d.ts("Backend ping latency (ms)", [('max by (endpoint) (proxysql_connpool_latency_us) / 1000', "{{endpoint}}")], unit="ms")
save(d)

# =============================================================================
# 6. Redis
# =============================================================================
d = Dash("chatapp-redis", "ChatApp - Redis", ["redis", "cache"], description="Conversation cache: clients, hit ratio, throughput, memory.")
d.row("Redis")
d.stat("Connected clients", ['redis_connected_clients'], w=4, decimals=0)
d.gauge("Cache hit ratio %", ['100 * rate(redis_keyspace_hits_total[$__rate_interval]) / (rate(redis_keyspace_hits_total[$__rate_interval]) + rate(redis_keyspace_misses_total[$__rate_interval]))'],
        w=4, thresholds=steps((RED, None), (YELLOW, 50), (GREEN, 80)))
d.stat("Commands / sec", ['rate(redis_commands_processed_total[$__rate_interval])'], w=4, unit="ops", decimals=1)
d.gauge("Memory usage %", ['100 * redis_memory_used_bytes / redis_memory_max_bytes'], w=4, thresholds=steps((GREEN, None), (YELLOW, 60), (RED, 80)), description="Relative to maxmemory (set to 256mb in docker-compose).")
d.stat("Keys", ['sum(redis_db_keys)'], w=4, decimals=0)
d.stat("Evicted keys / min", ['60 * rate(redis_evicted_keys_total[$__rate_interval])'], w=4, decimals=2, thresholds=steps((GREEN, None), (YELLOW, 1)))
d.ts("Connected & blocked clients", [('redis_connected_clients', "connected"), ('redis_blocked_clients', "blocked")])
d.ts("Cache hit ratio (%)", [('100 * rate(redis_keyspace_hits_total[$__rate_interval]) / (rate(redis_keyspace_hits_total[$__rate_interval]) + rate(redis_keyspace_misses_total[$__rate_interval]))', "server hit ratio"),
                             ('100 * sum(rate(chatapp_cache_requests{result="hit"}[$__rate_interval])) / sum(rate(chatapp_cache_requests[$__rate_interval]))', "app conversation-cache hit ratio")], unit="percent", maxv=100)
d.ts("Command throughput", [('rate(redis_commands_processed_total[$__rate_interval])', "total ops/s")], unit="ops")
d.ts("Memory usage", [('redis_memory_used_bytes', "used"), ('redis_memory_max_bytes', "maxmemory")], unit="bytes")
d.ts("Top commands / sec", [('topk(8, sum by (cmd) (rate(redis_commands_total[$__rate_interval])))', "{{cmd}}")], unit="ops")
d.ts("Avg command latency", [('sum by (cmd) (rate(redis_commands_duration_seconds_total[$__rate_interval])) / sum by (cmd) (rate(redis_commands_total[$__rate_interval]))', "{{cmd}}")], unit="s")
d.ts("Network I/O", [('rate(redis_net_input_bytes_total[$__rate_interval])', "in"), ('rate(redis_net_output_bytes_total[$__rate_interval])', "out")], unit="Bps")
d.ts("Hits vs misses / sec", [('rate(redis_keyspace_hits_total[$__rate_interval])', "hits"), ('rate(redis_keyspace_misses_total[$__rate_interval])', "misses")], unit="ops")
save(d)

# =============================================================================
# 7. Application connection pools (MongoDB driver + Sequelize)
# =============================================================================
d = Dash("chatapp-db-pools", "ChatApp - Connection pools (MongoDB driver, Sequelize)", ["pool", "mongodb", "database"],
         description="Driver-side pools reported by the services. MongoDB numbers come from the driver's CMAP events.")
d.var_query("db_system", "label_values(chatapp_db_pool_max_connections, db_system)", "Datastore")
Q = 'db_system=~"$db_system"'
d.row("Pool saturation")
d.stat("Client connections (in use)", [f'sum(chatapp_db_pool_connections{{{Q},state="in_use"}})'], w=4, decimals=0, description="Connections currently checked out by application code.")
d.stat("Server connections (open)", [f'sum(chatapp_db_pool_connections{{{Q},state="total"}})'], w=4, decimals=0, description="Connections the pool holds open to the database server.")
d.stat("Clients waiting for a connection", [f'sum(chatapp_db_pool_pending_requests{{{Q}}})'], w=4, decimals=0, thresholds=steps((GREEN, None), (YELLOW, 1), (RED, 5)))
d.gauge("% of pool in use", [f'100 * sum(chatapp_db_pool_connections{{{Q},state="in_use"}}) / sum(chatapp_db_pool_max_connections{{{Q}}})'], w=4, thresholds=steps((GREEN, None), (YELLOW, 60), (RED, 80)))
d.stat("Max pool size", [f'sum(chatapp_db_pool_max_connections{{{Q}}})'], w=4, decimals=0)
d.stat("Checkout failures (range)", [f'sum(increase(chatapp_db_pool_checkout_failures{{{Q}}}[$__range])) or vector(0)'], w=4, decimals=0, graph=False, thresholds=steps((GREEN, None), (RED, 1)))
d.ts("Client connections vs server connections", [(f'sum by (db_system, job) (chatapp_db_pool_connections{{{Q},state="in_use"}})', "in use - {{db_system}} ({{job}})"),
                                                  (f'sum by (db_system, job) (chatapp_db_pool_connections{{{Q},state="idle"}})', "idle - {{db_system}} ({{job}})"),
                                                  (f'sum by (db_system, job) (chatapp_db_pool_connections{{{Q},state="total"}})', "open - {{db_system}} ({{job}})")], stack=False)
d.ts("Clients waiting for a connection", [(f'sum by (db_system, job) (chatapp_db_pool_pending_requests{{{Q}}})', "{{db_system}} ({{job}})")])
d.ts("% of pool in use", [(f'100 * sum by (db_system, job) (chatapp_db_pool_connections{{{Q},state="in_use"}}) / sum by (db_system, job) (chatapp_db_pool_max_connections{{{Q}}})', "{{db_system}} ({{job}})")],
     unit="percent", thresholds=steps((GREEN, None), (RED, 80)), threshold_style="line", maxv=100)
d.ts("Checkout failures / min", [(f'60 * sum by (db_system, reason) (rate(chatapp_db_pool_checkout_failures{{{Q}}}[{RI}]))', "{{db_system}} {{reason}}")])
d.ts("Mongo operation latency (Tempo span metrics, p95)", [('histogram_quantile(0.95, sum by (le, span_name) (rate(traces_spanmetrics_latency_bucket{service="chat-service",span_name=~"mongodb.*"}[$__rate_interval])))', "{{span_name}}")], unit="s", w=24)
save(d)

# =============================================================================
# 8. RabbitMQ
# =============================================================================
d = Dash("chatapp-rabbitmq", "ChatApp - RabbitMQ", ["rabbitmq", "messaging"], description="Queue depth, publish/ack rates and unacknowledged messages, plus application-level event KPIs.")
d.row("Broker")
d.stat("Messages waiting (ready)", ['sum(rabbitmq_queue_messages_ready)'], w=4, decimals=0, thresholds=steps((GREEN, None), (YELLOW, 100), (RED, 1000)))
d.stat("Unacked (delivered, not acked)", ['sum(rabbitmq_queue_messages_unacked)'], w=4, decimals=0, thresholds=steps((GREEN, None), (YELLOW, 50), (RED, 500)))
d.stat("Published / sec", ['sum(rate(rabbitmq_global_messages_received_total[$__rate_interval]))'], w=4, unit="ops", decimals=2)
d.stat("Acknowledged / sec", ['sum(rate(rabbitmq_global_messages_acknowledged_total[$__rate_interval]))'], w=4, unit="ops", decimals=2)
d.stat("Consumers", ['sum(rabbitmq_consumers)'], w=4, decimals=0, thresholds=steps((RED, None), (GREEN, 1)))
d.stat("Connections / channels", ['sum(rabbitmq_connections)', 'sum(rabbitmq_channels)'], w=4, decimals=0)
d.ts("Messages waiting in queues", [('sum(rabbitmq_queue_messages_ready)', "total ready"), ('sum by (queue) (rabbitmq_detailed_queue_messages_ready)', "{{queue}}")])
d.ts("Delivered but not yet acknowledged", [('sum(rabbitmq_queue_messages_unacked)', "total unacked"), ('sum by (queue) (rabbitmq_detailed_queue_messages_unacked)', "{{queue}}")])
d.ts("Messages published / sec", [('sum(rate(rabbitmq_global_messages_received_total[$__rate_interval]))', "published"), ('sum(rate(rabbitmq_global_messages_confirmed_total[$__rate_interval]))', "confirmed"),
                                  ('sum(rate(rabbitmq_global_messages_unroutable_dropped_total[$__rate_interval]))', "unroutable dropped")], unit="ops")
d.ts("Messages acknowledged / sec", [('sum(rate(rabbitmq_global_messages_acknowledged_total[$__rate_interval]))', "acked"), ('sum(rate(rabbitmq_global_messages_delivered_total[$__rate_interval]))', "delivered"),
                                     ('sum(rate(rabbitmq_global_messages_redelivered_total[$__rate_interval]))', "redelivered")], unit="ops")
d.ts("Queue totals", [('sum by (queue) (rabbitmq_detailed_queue_messages)', "{{queue}}")], w=8)
d.ts("Node memory / FD", [('rabbitmq_process_resident_memory_bytes', "rss")], w=8, unit="bytes")
d.ts("Connections, channels, consumers", [('sum(rabbitmq_connections)', "connections"), ('sum(rabbitmq_channels)', "channels"), ('sum(rabbitmq_consumers)', "consumers")], w=8)
d.row("Application view (OpenTelemetry)")
d.ts("Events published / sec by routing key", [('sum by (messaging_rabbitmq_destination_routing_key, outcome) (rate(chatapp_events_published[$__rate_interval]))', "{{messaging_rabbitmq_destination_routing_key}} ({{outcome}})")], unit="ops")
d.ts("Events consumed / sec by queue", [('sum by (queue, outcome) (rate(chatapp_events_consumed[$__rate_interval]))', "{{queue}} ({{outcome}})")], unit="ops")
d.ts("Event processing latency p50 / p95", [('histogram_quantile(0.50, sum by (le, queue) (rate(chatapp_events_processing_duration_bucket[$__rate_interval])))', "p50 {{queue}}"),
                                            ('histogram_quantile(0.95, sum by (le, queue) (rate(chatapp_events_processing_duration_bucket[$__rate_interval])))', "p95 {{queue}}")], unit="s")
d.traces("Recent event-processing traces (publisher -> broker -> consumer)", '{ name =~ "event.process.*" }', w=12)
save(d)

# =============================================================================
# 9. k6 load tests
# =============================================================================
d = Dash("chatapp-k6", "ChatApp - k6 load tests", ["k6", "performance"], refresh="5s", time_from="now-30m",
         description="Live results while running tests/k6 scripts with the Prometheus remote-write output (see tests/README.md). Metric names follow k6's experimental-prometheus-rw output.")
d.var_query("testid", "label_values(k6_vus, testid)", "Test run", multi=False, include_all=True)
T = 'testid=~"$testid"'
d.stat("Virtual users", [f'max(k6_vus{{{T}}})'], w=4, decimals=0)
d.stat("Requests / sec", [f'sum(rate(k6_http_reqs_total{{{T}}}[{RI}]))'], w=4, unit="reqps", decimals=1)
d.stat("Failed requests %", [f'100 * avg(k6_http_req_failed_rate{{{T}}})'], w=4, unit="percent", decimals=2, thresholds=steps((GREEN, None), (YELLOW, 1), (RED, 5)))
d.stat("p95 latency", [f'max(k6_http_req_duration_p95{{{T}}})'], w=4, unit="s", thresholds=steps((GREEN, None), (YELLOW, 0.5), (RED, 1)))
d.stat("Checks passed %", [f'100 * avg(k6_checks_rate{{{T}}})'], w=4, unit="percent", decimals=1, thresholds=steps((RED, None), (YELLOW, 95), (GREEN, 99)))
d.stat("Iterations / sec", [f'sum(rate(k6_iterations_total{{{T}}}[{RI}]))'], w=4, unit="ops", decimals=1)
d.ts("VUs vs request rate", [(f'max(k6_vus{{{T}}})', "VUs"), (f'sum(rate(k6_http_reqs_total{{{T}}}[{RI}]))', "req/s")])
d.ts("Client-side latency (k6)", [(f'max(k6_http_req_duration_p95{{{T}}})', "p95"), (f'max(k6_http_req_duration_p99{{{T}}})', "p99"), (f'max(k6_http_req_duration_avg{{{T}}})', "avg")], unit="s")
d.ts("Server-side p95 during the test (from services)", [(f'histogram_quantile(0.95, sum by (le, job) (rate(chatapp_http_server_duration_bucket[{RI}])))', "{{job}}")], unit="s")
d.ts("Server-side 5xx % during the test", [(f'100 * sum by (job) (rate(chatapp_http_server_requests{{http_status_code=~"5.."}}[{RI}])) / sum by (job) (rate(chatapp_http_server_requests[{RI}]))', "{{job}}")], unit="percent")
d.ts("Container CPU % of limit during the test", [('100 * sum by (name) (rate(container_cpu_usage_seconds_total{name=~"chatapp-.+"}[2m])) / max by (name) (container_spec_cpu_quota{name=~"chatapp-.+"} / container_spec_cpu_period{name=~"chatapp-.+"} > 0)', "{{name}}")],
     unit="percent", thresholds=steps((GREEN, None), (RED, 40)), threshold_style="line")
d.ts("Container memory % of limit during the test", [('100 * max by (name) (container_memory_working_set_bytes{name=~"chatapp-.+"}) / max by (name) (container_spec_memory_limit_bytes{name=~"chatapp-.+"} > 0)', "{{name}}")],
     unit="percent", thresholds=steps((GREEN, None), (RED, 40)), threshold_style="line")
save(d)
