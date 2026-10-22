import { logs, SeverityNumber } from '@opentelemetry/api-logs';

/**
 * A pino destination that forwards every log line to the OpenTelemetry Logs
 * API. pino calls write() synchronously inside the log call, so the active
 * span context is still the caller's and the SDK stamps trace_id / span_id on
 * the record automatically -- that is what lets Grafana jump from a log line
 * to its trace.
 */
const SEVERITY: Record<number, { number: SeverityNumber; text: string }> = {
  10: { number: SeverityNumber.TRACE, text: 'TRACE' },
  20: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
  30: { number: SeverityNumber.INFO, text: 'INFO' },
  40: { number: SeverityNumber.WARN, text: 'WARN' },
  50: { number: SeverityNumber.ERROR, text: 'ERROR' },
  60: { number: SeverityNumber.FATAL, text: 'FATAL' },
};

type AttributeValue = string | number | boolean;

const toAttribute = (value: unknown): AttributeValue | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

// Fields pino/our mixin add that are represented natively on a LogRecord.
const RESERVED = new Set([
  'level',
  'time',
  'msg',
  'pid',
  'hostname',
  'name',
  'trace_id',
  'span_id',
  'trace_flags',
  'err',
  'error',
]);

interface SerializedError {
  type?: string;
  message?: string;
  stack?: string;
}

export const createOtelLogStream = (loggerName: string) => {
  const otelLogger = logs.getLogger(loggerName);

  return {
    write(line: string): void {
      try {
        const record = JSON.parse(line) as Record<string, unknown>;
        const severity = SEVERITY[Number(record.level)] ?? SEVERITY[30];

        const attributes: Record<string, AttributeValue> = { 'logger.name': loggerName };
        for (const [key, value] of Object.entries(record)) {
          if (RESERVED.has(key)) {
            continue;
          }
          const attribute = toAttribute(value);
          if (attribute !== undefined) {
            attributes[key] = attribute;
          }
        }

        const err = (record.err ?? record.error) as SerializedError | string | undefined;
        if (err && typeof err === 'object') {
          if (err.type) attributes['exception.type'] = err.type;
          if (err.message) attributes['exception.message'] = err.message;
          if (err.stack) attributes['exception.stacktrace'] = err.stack;
        } else if (typeof err === 'string') {
          attributes['exception.message'] = err;
        }

        const message = typeof record.msg === 'string' && record.msg ? record.msg : undefined;

        otelLogger.emit({
          severityNumber: severity.number,
          severityText: severity.text,
          body: message ?? (err && typeof err === 'object' ? (err.message ?? line) : line),
          timestamp: typeof record.time === 'number' ? record.time : Date.now(),
          attributes,
        });
      } catch {
        // Never let log shipping break the application.
      }
    },
  };
};
