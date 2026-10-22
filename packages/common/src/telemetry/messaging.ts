import { SpanKind, context, propagation, trace } from '@opentelemetry/api';

import { appMetrics } from './app-metrics.js';
import { withSpan } from './tracing.js';

/**
 * RabbitMQ context propagation.
 *
 * The amqplib auto-instrumentation already injects/extracts W3C trace context
 * on publish/consume. These helpers make propagation explicit and independent
 * of that instrumentation (so a trace never breaks at the broker), and add
 * business-level spans + KPI metrics around event handling.
 */
export interface PublishTarget {
  exchange: string;
  routingKey: string;
}

export const withPublishSpan = <T>(
  target: PublishTarget,
  publish: (headers: Record<string, string>) => Promise<T> | T,
): Promise<T> =>
  withSpan(
    `event.publish ${target.routingKey}`,
    async () => {
      // Carry the current trace context to the consumer in message headers.
      const headers: Record<string, string> = {};
      propagation.inject(context.active(), headers);

      try {
        const result = await publish(headers);
        appMetrics.eventsPublished.add(1, {
          'messaging.rabbitmq.destination.routing_key': target.routingKey,
          outcome: 'success',
        });
        return result;
      } catch (error) {
        appMetrics.eventsPublished.add(1, {
          'messaging.rabbitmq.destination.routing_key': target.routingKey,
          outcome: 'failure',
        });
        throw error;
      }
    },
    {
      attributes: {
        'messaging.system': 'rabbitmq',
        'messaging.operation.type': 'publish',
        'messaging.destination.name': target.exchange,
        'messaging.rabbitmq.destination.routing_key': target.routingKey,
      },
    },
  );

export interface ConsumedMessageLike {
  fields: { exchange: string; routingKey: string; redelivered?: boolean };
  properties: { headers?: Record<string, unknown> | undefined };
}

export const withConsumeSpan = async <T>(
  message: ConsumedMessageLike,
  queue: string,
  handler: () => Promise<T>,
): Promise<T> => {
  // If the amqplib instrumentation already opened a consumer span we nest under
  // it; otherwise continue the producer's trace from the message headers.
  const parent = trace.getActiveSpan()
    ? context.active()
    : propagation.extract(context.active(), message.properties.headers ?? {});

  const startedAt = process.hrtime.bigint();
  const attributes = {
    queue,
    'messaging.rabbitmq.destination.routing_key': message.fields.routingKey,
  };

  return context.with(parent, () =>
    withSpan(
      `event.process ${message.fields.routingKey}`,
      async () => {
        try {
          const result = await handler();
          appMetrics.eventsConsumed.add(1, { ...attributes, outcome: 'success' });
          return result;
        } catch (error) {
          appMetrics.eventsConsumed.add(1, { ...attributes, outcome: 'failure' });
          throw error;
        } finally {
          appMetrics.eventProcessingDuration.record(
            Number(process.hrtime.bigint() - startedAt) / 1e9,
            attributes,
          );
        }
      },
      {
        attributes: {
          'messaging.system': 'rabbitmq',
          'messaging.operation.type': 'process',
          'messaging.destination.name': message.fields.exchange,
          'messaging.rabbitmq.destination.routing_key': message.fields.routingKey,
          'messaging.message.redelivered': message.fields.redelivered ?? false,
          'messaging.consumer.queue': queue,
        },
        kind: SpanKind.INTERNAL,
      },
    ),
  );
};
