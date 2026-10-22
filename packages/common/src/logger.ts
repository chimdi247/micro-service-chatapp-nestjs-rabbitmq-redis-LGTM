import { context, trace } from '@opentelemetry/api';
import pino, { type Logger, type LoggerOptions } from 'pino';

import { createOtelLogStream } from './telemetry/log-stream.js';

type CreateLoggerOptions = LoggerOptions & {
  name: string;
};

/**
 * Adds trace_id / span_id / trace_flags of the active span to every log line.
 * These keys are what Loki's derived field (and Grafana's trace-to-logs
 * correlation) pivot on.
 */
const traceMixin = (): Record<string, string> => {
  const span = trace.getSpan(context.active());
  if (!span) {
    return {};
  }

  const { traceId, spanId, traceFlags } = span.spanContext();
  return {
    trace_id: traceId,
    span_id: spanId,
    trace_flags: `0${traceFlags.toString(16)}`.slice(-2),
  };
};

export const createLogger = (options: CreateLoggerOptions): Logger => {
  const { name, ...rest } = options;
  const level = process.env.LOG_LEVEL || 'info';

  const baseOptions: LoggerOptions = {
    name,
    level,
    mixin: traceMixin,
    // Existing call sites log errors under both `err` and `error`; serialise
    // both as proper errors (type/message/stack) instead of `{}`.
    serializers: { err: pino.stdSerializers.err, error: pino.stdSerializers.err },
    ...rest,
  };

  if (process.env.NODE_ENV === 'development') {
    // Local dev: human-readable output, no OTLP shipping.
    return pino({
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      },
    });
  }

  // Containers: JSON on stdout (docker logs) AND the same record shipped over
  // OTLP (collector -> Loki) with trace context attached. When telemetry is
  // disabled the OTel Logs API is a no-op, so this stays cheap.
  return pino(
    baseOptions,
    pino.multistream([
      { stream: process.stdout, level: 'trace' },
      { stream: createOtelLogStream(name), level: 'trace' },
    ]),
  );
};
