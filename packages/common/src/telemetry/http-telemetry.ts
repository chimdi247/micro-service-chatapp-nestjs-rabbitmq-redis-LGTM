import { context, metrics } from '@opentelemetry/api';
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';

import { resolveRouteLabel } from './route.js';

const meter = metrics.getMeter('chatapp.http');

const requests = meter.createCounter('chatapp.http.server.requests', {
  description: 'Completed inbound HTTP requests',
  unit: '{request}',
});
const duration = meter.createHistogram('chatapp.http.server.duration', {
  description: 'Inbound HTTP request duration',
  unit: 's',
});
const active = meter.createUpDownCounter('chatapp.http.server.active_requests', {
  description: 'Inbound HTTP requests currently being served',
  unit: '{request}',
});

export interface HttpTelemetryOptions {
  /** Exact paths to skip (health checks by default). */
  ignorePaths?: string[];
}

/**
 * Express middleware (mount FIRST) that provides, per request:
 *  - RED metrics: chatapp_http_server_requests / _duration / _active_requests
 *    labelled with method, route template and status code
 *  - a structured access log line carrying trace_id/span_id, so a log line in
 *    Grafana links straight to its trace
 *
 * Status 499 is recorded for requests the client aborted before we responded.
 */
export const createHttpTelemetryMiddleware = (
  logger: Logger,
  options: HttpTelemetryOptions = {},
): RequestHandler => {
  const ignored = new Set(options.ignorePaths ?? ['/health', '/healthz', '/metrics']);

  return (req, res, next) => {
    if (ignored.has(req.path)) {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();
    // Capture the request context (it holds the server span) so the log line
    // emitted on 'finish' is correlated even if the event loop tick differs.
    const requestContext = context.active();
    const method = req.method;
    active.add(1, { 'http.method': method });

    let finalized = false;
    const finalize = (aborted: boolean) => {
      if (finalized) {
        return;
      }
      finalized = true;

      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      const status = aborted ? 499 : res.statusCode;
      const route = resolveRouteLabel(req.originalUrl, Boolean(req.route), status);
      const attributes = {
        'http.method': method,
        'http.route': route,
        'http.status_code': status,
      };

      active.add(-1, { 'http.method': method });
      requests.add(1, attributes);
      duration.record(seconds, attributes);

      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      context.with(requestContext, () => {
        logger[level](
          {
            http_method: method,
            http_route: route,
            http_status_code: status,
            http_target: req.originalUrl.split('?')[0],
            duration_ms: Math.round(seconds * 1000 * 100) / 100,
            user_agent: req.headers['user-agent'],
          },
          'http request completed',
        );
      });
    };

    res.once('finish', () => finalize(false));
    res.once('close', () => finalize(!res.writableFinished));
    next();
  };
};
