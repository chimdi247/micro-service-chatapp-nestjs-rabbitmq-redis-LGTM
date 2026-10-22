import { SpanKind, SpanStatusCode, trace, type Attributes, type Span } from '@opentelemetry/api';

import { HttpError } from '../errors/http-error.js';

export const getTracer = () => trace.getTracer('chatapp');

export interface SpanOptions {
  attributes?: Attributes;
  kind?: SpanKind;
}

/**
 * Records an exception on a span. Expected business errors (HttpError < 500,
 * e.g. 401 invalid credentials, 409 duplicate email) are annotated but do NOT
 * turn the span red, so trace error views and span-metrics error rates only
 * reflect genuine failures.
 */
export const recordSpanError = (span: Span, error: unknown): void => {
  const err = error instanceof Error ? error : new Error(String(error));
  span.recordException(err);

  if (error instanceof HttpError && error.statusCode < 500) {
    span.setAttribute('error.expected', true);
    span.setAttribute('http.response.status_code', error.statusCode);
    return;
  }

  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
};

/**
 * Runs `fn` inside a new active span (manual instrumentation for important
 * business logic). The span ends when `fn` settles; errors are recorded and
 * rethrown unchanged.
 */
export const withSpan = <T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  options: SpanOptions = {},
): Promise<T> =>
  getTracer().startActiveSpan(
    name,
    { attributes: options.attributes, kind: options.kind ?? SpanKind.INTERNAL },
    async (span) => {
      try {
        return await fn(span);
      } catch (error) {
        recordSpanError(span, error);
        throw error;
      } finally {
        span.end();
      }
    },
  );

/** Attach attributes to whatever span is currently active (no-op otherwise). */
export const setActiveSpanAttributes = (attributes: Attributes): void => {
  trace.getActiveSpan()?.setAttributes(attributes);
};

/** Record an error on the active span, if any (used by Express error handlers). */
export const recordActiveSpanError = (error: unknown): void => {
  const span = trace.getActiveSpan();
  if (span) {
    recordSpanError(span, error);
  }
};

/**
 * Wraps a datastore call in a CLIENT span so it shows up as an edge in the
 * Tempo service graph (peer.service becomes the virtual node name). Used where
 * no auto-instrumentation covers the driver (MongoDB).
 */
export const withDbSpan = <T>(
  system: string,
  dbName: string,
  collection: string,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> =>
  withSpan(`${system}.${collection}.${operation}`, fn, {
    kind: SpanKind.CLIENT,
    attributes: {
      'db.system': system,
      'db.name': dbName,
      'db.collection.name': collection,
      'db.operation.name': operation,
      'peer.service': system,
    },
  });
