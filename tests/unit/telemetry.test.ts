import { SpanStatusCode } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { HttpError, recordSpanError } from '@chatapp/common';

import { createOtelLogStream } from '../../packages/common/src/telemetry/log-stream';

const fakeSpan = () => ({
  recordException: vi.fn(),
  setStatus: vi.fn(),
  setAttribute: vi.fn(),
});

describe('recordSpanError', () => {
  it('marks unexpected errors as ERROR', () => {
    const span = fakeSpan();
    recordSpanError(span as any, new Error('db down'));
    expect(span.recordException).toHaveBeenCalled();
    expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR, message: 'db down' });
  });

  it('keeps spans green for expected 4xx business errors', () => {
    const span = fakeSpan();
    recordSpanError(span as any, new HttpError(401, 'Invalid credentials'));
    expect(span.setAttribute).toHaveBeenCalledWith('error.expected', true);
    expect(span.setStatus).not.toHaveBeenCalled();
  });

  it('marks 5xx HttpErrors as ERROR', () => {
    const span = fakeSpan();
    recordSpanError(span as any, new HttpError(503, 'upstream'));
    expect(span.setStatus).toHaveBeenCalled();
  });
});

describe('pino -> OpenTelemetry log stream', () => {
  const emitted: any[] = [];

  beforeAll(() => {
    logs.setGlobalLoggerProvider({ getLogger: () => ({ emit: (record: unknown) => emitted.push(record) }) } as any);
  });

  it('maps level, message and attributes; keeps trace ids off the attributes', () => {
    const stream = createOtelLogStream('unit-test');
    stream.write(
      JSON.stringify({
        level: 50,
        time: 1_700_000_000_000,
        msg: 'boom',
        trace_id: 'abc',
        span_id: 'def',
        user_id: 'u-1',
        meta: { a: 1 },
        err: { type: 'Error', message: 'kaput', stack: 'stack...' },
      }),
    );

    const record = emitted.at(-1);
    expect(record.severityText).toBe('ERROR');
    expect(record.body).toBe('boom');
    expect(record.timestamp).toBe(1_700_000_000_000);
    expect(record.attributes).toMatchObject({
      'logger.name': 'unit-test',
      user_id: 'u-1',
      meta: '{"a":1}',
      'exception.message': 'kaput',
    });
    expect(record.attributes.trace_id).toBeUndefined();
  });

  it('never throws on malformed input', () => {
    expect(() => createOtelLogStream('x').write('not json')).not.toThrow();
  });
});
