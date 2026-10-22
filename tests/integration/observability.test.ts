import { randomBytes } from 'node:crypto';

import { api, eventually, registerUser } from '../lib/api';
import { config } from '../lib/config';

const getJson = async (url: string, headers: Record<string, string> = {}) => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json() as Promise<any>;
};

const promQuery = async (query: string) =>
  getJson(`${config.mimir}/prometheus/api/v1/query?query=${encodeURIComponent(query)}`);

describe('observability pipeline (OpenTelemetry -> Tempo / Mimir / Loki)', () => {
  // A fixed W3C trace id that we inject; every service must continue it.
  const traceId = randomBytes(16).toString('hex');
  const traceparent = `00-${traceId}-${randomBytes(8).toString('hex')}-01`;

  beforeAll(async () => {
    // register -> auth-service -> RabbitMQ -> user-service -> RabbitMQ -> chat-service
    await registerUser('otel', { traceparent });
    await api('/conversations', { token: '' }).catch(() => undefined); // generate a 401 too
  });

  it('propagates ONE trace across gateway, auth, user and chat services (HTTP + RabbitMQ)', async () => {
    const services = await eventually(
      async () => {
        const trace = await getJson(`${config.tempo}/api/traces/${traceId}`).catch(() => undefined);
        if (!trace) return null;
        const found = new Set<string>();
        for (const batch of trace.batches ?? []) {
          for (const attr of batch.resource?.attributes ?? []) {
            if (attr.key === 'service.name') found.add(attr.value.stringValue);
          }
        }
        return ['gateway-service', 'auth-service', 'user-service', 'chat-service'].every((s) => found.has(s)) ? found : null;
      },
      { timeoutMs: 90_000, intervalMs: 3_000, label: 'a single trace spanning all four services' },
    );
    expect(services.size).toBeGreaterThanOrEqual(4);
  });

  it('exposes RED + business metrics in Mimir', async () => {
    for (const metric of ['chatapp_http_server_requests', 'chatapp_users_registered', 'chatapp_process_uptime']) {
      await eventually(
        async () => (await promQuery(metric)).data?.result?.length > 0,
        { timeoutMs: 90_000, intervalMs: 3_000, label: `${metric} in Mimir` },
      );
    }
  });

  it('scrapes infrastructure exporters (cAdvisor, node, rabbitmq, redis, pgbouncer)', async () => {
    for (const job of ['cadvisor', 'node-exporter', 'rabbitmq', 'redis', 'pgbouncer', 'postgres-primary']) {
      await eventually(
        async () => (await promQuery(`up{job="${job}"} == 1`)).data?.result?.length > 0,
        { timeoutMs: 90_000, intervalMs: 3_000, label: `scrape job ${job} to be up` },
      );
    }
  });

  it('stores structured logs in Loki with the trace_id for log -> trace pivoting', async () => {
    await eventually(
      async () => {
        const end = Date.now() * 1_000_000;
        const start = end - 15 * 60 * 1_000_000_000;
        const q = encodeURIComponent(`{service_name="auth-service"} | trace_id="${traceId}"`);
        const res = await getJson(`${config.loki}/loki/api/v1/query_range?query=${q}&start=${start}&end=${end}&limit=5`);
        return res.data?.result?.length > 0;
      },
      { timeoutMs: 90_000, intervalMs: 3_000, label: `logs carrying trace_id ${traceId}` },
    );
  });

  it('has Grafana provisioned with the datasources, dashboards and alert rules', async () => {
    const auth = { authorization: `Basic ${Buffer.from(`${config.grafanaUser}:${config.grafanaPassword}`).toString('base64')}` };

    const datasources = await getJson(`${config.grafana}/api/datasources`, auth);
    expect(datasources.map((d: any) => d.uid).sort()).toEqual(expect.arrayContaining(['loki', 'mimir', 'tempo']));

    const dashboards = await getJson(`${config.grafana}/api/search?tag=chatapp`, auth);
    expect(dashboards.length).toBeGreaterThanOrEqual(9);

    const rules = await getJson(`${config.grafana}/api/v1/provisioning/alert-rules`, auth);
    const titles: string[] = rules.map((r: any) => r.title);
    expect(titles).toEqual(expect.arrayContaining(['Container CPU above 40% of its limit', 'Container memory above 40% of its limit']));
  });
});
