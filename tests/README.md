# Tests

| Suite | Tool | Command (from `tests/`) | Needs the stack? |
|---|---|---|---|
| Unit | Vitest | `pnpm test:unit` | No |
| Integration (API, RabbitMQ sync, cache) | Vitest | `pnpm test:integration` | Yes |
| Observability pipeline (trace across services, metrics, logs, Grafana provisioning) | Vitest | `pnpm test:observability` | Yes |
| E2E | Playwright | `pnpm test:e2e:install && pnpm test:e2e` | Yes |
| Browser (Selenium WebDriver) | Selenium + Vitest | `pnpm test:selenium` | Yes |
| Smoke | k6 | `pnpm k6:smoke` | Yes |
| Load | k6 | `pnpm k6:load` | Yes |
| Stress | k6 | `pnpm k6:stress` | Yes |
| Spike | k6 | `pnpm k6:spike` | Yes |
| Soak | k6 | `SOAK_DURATION=4h pnpm k6:soak` | Yes |
| Breakpoint (capacity) | k6 | `pnpm k6:breakpoint` | Yes (not prod) |
| Connection-pool saturation | k6 | `pnpm k6:pool` | Yes |
| Alert trigger (CPU > 40%) | k6 | `pnpm k6:alert` | Yes |

Setup: `cd tests && pnpm install` (unit tests also need `pnpm install` at the repo root, since they import
`packages/common` from source). Targets default to localhost; copy `.env.example` to override.

## k6 without installing k6 (docker, results visible in Grafana)

```bash
docker compose --profile tests run --rm k6 run -o experimental-prometheus-rw \
  --tag testid=load-$(date +%s) /scripts/load.js
```

The `k6` service pushes to Mimir, so the **k6 load tests** dashboard shows VUs, client-side latency and the
server-side latency / 5xx / CPU / memory / pool saturation side by side. Tune with env vars, e.g.
`-e VUS=50 -e HOLD=10m`, `-e SPIKE_VUS=300`, `-e MAX_RPS=800`.

## Selenium

Default: local headless Chrome (Selenium Manager fetches the driver). For a container grid on Linux:
`docker compose --profile tests up -d selenium` then `SELENIUM_REMOTE_URL=http://localhost:4444/wd/hub pnpm test:selenium`
(the service uses host networking so the browser can reach `localhost:3000/4000`).

## Notes

* Fixture users are created via the API in each k6 `setup()` (registration is bcrypt-heavy by design, so the
  per-iteration mix keeps registration/login rare). Created accounts use `@loadtest.local` / `@e2e.local` /
  `@integration.local`.
* These suites were written but **not executed** in the environment that produced them; see
  `observability/README.md` for the same caveat on the stack.
