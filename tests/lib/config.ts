const env = (name: string, fallback: string): string => process.env[name] ?? fallback;

export const config = {
  gateway: env('GATEWAY_URL', 'http://localhost:4000'),
  client: env('CLIENT_URL', 'http://localhost:3000'),
  grafana: env('GRAFANA_URL', 'http://localhost:3001'),
  grafanaUser: env('GRAFANA_USER', 'admin'),
  grafanaPassword: env('GRAFANA_PASSWORD', 'admin123'),
  mimir: env('MIMIR_URL', 'http://localhost:9009'),
  loki: env('LOKI_URL', 'http://localhost:3100'),
  tempo: env('TEMPO_URL', 'http://localhost:3200'),
  password: 'Password123!',
};
