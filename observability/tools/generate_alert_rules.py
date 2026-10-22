#!/usr/bin/env python3
"""Generates grafana/provisioning/alerting/alert-rules.yaml.

Edit RULES below and re-run:  python3 observability/tools/generate_alert_rules.py
Every rule is a classic Grafana-managed 3-step pipeline:
  A = Mimir query (instant)  ->  B = reduce(last)  ->  C = threshold
NOTE: annotation text is intentionally static (no Go-template `$labels`):
provisioning files interpolate `$VAR`, and Grafana's email already lists all
labels (container name, service, ...) of the firing instance.
"""
import pathlib
import yaml

CONTAINER = 'name=~"chatapp-.+"'

# (uid, title, expr, op, threshold, for, severity, summary, no_data_state)
RESOURCE = [
    ("chatapp-node-cpu-high", "Node CPU above 40%",
     '100 - avg(rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100',
     "gt", 40, "2m", "warning", "Host CPU utilisation is above 40%.", "OK"),
    ("chatapp-node-memory-high", "Node memory above 40%",
     '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
     "gt", 40, "2m", "warning", "Host memory utilisation is above 40%.", "OK"),
    ("chatapp-container-cpu-high", "Container CPU above 40% of its limit",
     f'100 * sum by (name) (rate(container_cpu_usage_seconds_total{{{CONTAINER}}}[2m])) '
     f'/ max by (name) (container_spec_cpu_quota{{{CONTAINER}}} / container_spec_cpu_period{{{CONTAINER}}} > 0)',
     "gt", 40, "2m", "warning",
     "A container is using more than 40% of its CPU limit (see the 'name' label).", "OK"),
    ("chatapp-container-memory-high", "Container memory above 40% of its limit",
     f'100 * max by (name) (container_memory_working_set_bytes{{{CONTAINER}}}) '
     f'/ max by (name) (container_spec_memory_limit_bytes{{{CONTAINER}}} > 0)',
     "gt", 40, "2m", "warning",
     "A container is using more than 40% of its memory limit (see the 'name' label).", "OK"),
]

SERVICE = [
    ("chatapp-service-down", "Service health probe failing",
     'min by (service) (probe_success{job="blackbox-http"})',
     "lt", 1, "1m", "critical", "A service /health probe has been failing for 1 minute.", "Alerting"),
    ("chatapp-high-error-rate", "HTTP 5xx error rate above 5%",
     '100 * sum by (job) (rate(chatapp_http_server_requests{http_status_code=~"5.."}[5m])) '
     '/ sum by (job) (rate(chatapp_http_server_requests[5m]))',
     "gt", 5, "5m", "critical", "More than 5% of a service's requests are failing with 5xx (availability SLO at risk).", "OK"),
    ("chatapp-high-latency-p95", "HTTP p95 latency above 1s",
     'histogram_quantile(0.95, sum by (le, job) (rate(chatapp_http_server_duration_bucket[5m])))',
     "gt", 1, "5m", "warning", "A service's p95 latency is above 1 second (latency SLO at risk).", "OK"),
]

DATA = [
    ("chatapp-rabbitmq-backlog", "RabbitMQ backlog above 1000 messages",
     'sum(rabbitmq_queue_messages_ready)',
     "gt", 1000, "5m", "warning", "Messages are piling up in RabbitMQ queues; consumers may be down or slow.", "OK"),
    ("chatapp-postgres-connections-high", "PostgreSQL connections above 80% of max",
     '100 * pg_connections_total{job="postgres-primary"} / pg_connections_max{job="postgres-primary"}',
     "gt", 80, "5m", "warning", "PostgreSQL is close to max_connections.", "OK"),
    ("chatapp-postgres-replication-lag", "PostgreSQL replication lag above 30s",
     'max(pg_replication_stat_replay_lag_seconds)',
     "gt", 30, "5m", "warning", "The PostgreSQL standby is more than 30 seconds behind the primary.", "OK"),
    ("chatapp-mongo-pool-saturated", "MongoDB driver pool above 80% in use",
     '100 * sum by (job) (chatapp_db_pool_connections{db_system="mongodb",state="in_use"}) '
     '/ sum by (job) (chatapp_db_pool_max_connections{db_system="mongodb"})',
     "gt", 80, "3m", "warning", "chat-service is nearly exhausting its MongoDB connection pool.", "OK"),
    ("chatapp-redis-memory-high", "Redis memory above 80% of maxmemory",
     '100 * redis_memory_used_bytes / redis_memory_max_bytes',
     "gt", 80, "5m", "warning", "Redis is close to its maxmemory limit (evictions imminent).", "OK"),
]


def rule(uid, title, expr, op, threshold, for_, severity, summary, no_data):
    return {
        "uid": uid,
        "title": title,
        "condition": "C",
        "data": [
            {
                "refId": "A",
                "relativeTimeRange": {"from": 600, "to": 0},
                "datasourceUid": "mimir",
                "model": {
                    "datasource": {"type": "prometheus", "uid": "mimir"},
                    "editorMode": "code",
                    "expr": expr,
                    "instant": True,
                    "range": False,
                    "intervalMs": 1000,
                    "maxDataPoints": 43200,
                    "refId": "A",
                },
            },
            {
                "refId": "B",
                "datasourceUid": "__expr__",
                "model": {
                    "type": "reduce",
                    "expression": "A",
                    "reducer": "last",
                    "settings": {"mode": "dropNN"},
                    "refId": "B",
                    "datasource": {"type": "__expr__", "uid": "__expr__"},
                },
            },
            {
                "refId": "C",
                "datasourceUid": "__expr__",
                "model": {
                    "type": "threshold",
                    "expression": "B",
                    "conditions": [{"evaluator": {"type": op, "params": [threshold]}}],
                    "refId": "C",
                    "datasource": {"type": "__expr__", "uid": "__expr__"},
                },
            },
        ],
        "noDataState": no_data,
        "execErrState": "Error",
        "for": for_,
        "annotations": {"summary": title, "description": summary},
        "labels": {"severity": severity},
        "isPaused": False,
    }


doc = {
    "apiVersion": 1,
    "groups": [
        {"orgId": 1, "name": "resource-utilization", "folder": "ChatApp Alerts", "interval": "1m",
         "rules": [rule(*r) for r in RESOURCE]},
        {"orgId": 1, "name": "service-slo", "folder": "ChatApp Alerts", "interval": "1m",
         "rules": [rule(*r) for r in SERVICE]},
        {"orgId": 1, "name": "data-layer", "folder": "ChatApp Alerts", "interval": "1m",
         "rules": [rule(*r) for r in DATA]},
    ],
}

out = pathlib.Path(__file__).resolve().parents[1] / "grafana/provisioning/alerting/alert-rules.yaml"
header = "# GENERATED by observability/tools/generate_alert_rules.py -- edit the script, not this file.\n"
out.write_text(header + yaml.safe_dump(doc, sort_keys=False, width=200))
print("wrote", out)
