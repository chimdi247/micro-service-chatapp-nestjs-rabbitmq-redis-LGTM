import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostname } from 'node:os';

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import {
  ExplicitBucketHistogramAggregation,
  PeriodicExportingMetricReader,
  View,
} from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

import { registerProcessMetrics } from './process-metrics.js';
import { resolveRouteLabel } from './route.js';

/** Latency buckets (seconds) shared by every duration histogram we own. */
const DURATION_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/** Paths that must never produce traces (container health checks, scrapes). */
const IGNORED_PATHS = new Set(['/health', '/healthz', '/metrics']);

export const SHUTDOWN_SYMBOL = Symbol.for('chatapp.telemetry.shutdown');

const isIgnoredRequest = (req: IncomingMessage): boolean => {
  const path = (req.url ?? '').split('?')[0];
  return IGNORED_PATHS.has(path);
};

export const startTelemetry = (): void => {
  // Only keep the env detector: the default process/host detectors add
  // high-cardinality attributes (pid, command args) we do not want in metrics.
  process.env.OTEL_NODE_RESOURCE_DETECTORS ??= 'env';
  // Logs are wired manually below (pino -> OTel Logs API), so stop NodeSDK from
  // creating a second, competing global LoggerProvider from env defaults.
  process.env.OTEL_LOGS_EXPORTER = 'none';

  if (process.env.OTEL_LOG_LEVEL?.toLowerCase() === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'unknown-service';

  const resource = new Resource({
    'service.name': serviceName,
    'service.version': process.env.SERVICE_VERSION ?? '1.0.0',
    // The Prometheus remote-write exporter maps this to the `instance` label.
    'service.instance.id': process.env.HOSTNAME ?? hostname(),
    'deployment.environment': process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? 'local',
  });

  // ---- Logs --------------------------------------------------------------
  const loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(new OTLPLogExporter()));
  logs.setGlobalLoggerProvider(loggerProvider);

  // ---- Traces + metrics + auto-instrumentation ---------------------------
  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL ?? 15_000),
    }),
    views: [
      new View({
        instrumentName: 'chatapp.http.server.duration',
        aggregation: new ExplicitBucketHistogramAggregation(DURATION_BUCKETS_SECONDS),
      }),
      new View({
        instrumentName: 'chatapp.events.processing.duration',
        aggregation: new ExplicitBucketHistogramAggregation(DURATION_BUCKETS_SECONDS),
      }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Very chatty / low value for this stack.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        // The MongoDB driver (v7) can be newer than the instrumentation's
        // supported range, so chat-service creates CLIENT spans itself
        // (withDbSpan) -- deterministic output regardless of driver version.
        '@opentelemetry/instrumentation-mongodb': { enabled: false },
        // We own log <-> trace correlation in @chatapp/common's pino logger.
        '@opentelemetry/instrumentation-pino': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: isIgnoredRequest,
          // Give server spans a low-cardinality name ("GET /conversations/:id")
          // and an http.route attribute, independent of the express
          // instrumentation's Express-5 support level.
          applyCustomAttributesOnSpan: (span, request, response) => {
            try {
              if (!('originalUrl' in request)) {
                return;
              }
              const req = request as IncomingMessage & {
                originalUrl: string;
                route?: unknown;
              };
              const route = resolveRouteLabel(
                req.originalUrl,
                Boolean(req.route),
                (response as ServerResponse).statusCode,
              );
              span.setAttribute('http.route', route);
              span.updateName(`${req.method ?? 'HTTP'} ${route}`);
            } catch {
              // Telemetry must never break a request.
            }
          },
        },
      }),
    ],
  });

  sdk.start();
  registerProcessMetrics();

  const shutdown = async (): Promise<void> => {
    await Promise.allSettled([sdk.shutdown(), loggerProvider.shutdown()]);
  };

  // Read by shutdownTelemetry() (shutdown.ts) so the app barrel does not have
  // to import the whole SDK.
  (globalThis as Record<symbol, unknown>)[SHUTDOWN_SYMBOL] = shutdown;
};
