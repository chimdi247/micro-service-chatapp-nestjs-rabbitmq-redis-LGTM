import {
  AUTH_EVENT_EXCHANGE,
  AUTH_USER_REGISTERED_ROUTING_KEY,
  withPublishSpan,
  type AuthUserRegisteredPayload,
} from '@chatapp/common';
import { connect, type Channel, type ChannelModel } from 'amqplib';

import { env } from '@/config/env';
import { logger } from '@/utils/logger';

let connectionRef: ChannelModel | null = null;
let channel: Channel | null = null;

export const initPublisher = async () => {
  if (!env.RABBITMQ_URL) {
    logger.warn('RABBITMQ_URL is not defined. Skipping RabbitMQ initialization.');
    return;
  }

  if (channel) {
    return;
  }

  const connection = await connect(env.RABBITMQ_URL);
  connectionRef = connection;
  channel = await connection.createChannel();
  await channel.assertExchange(AUTH_EVENT_EXCHANGE, 'topic', { durable: true });

  connection.on('close', () => {
    logger.warn('RabbitMQ connection closed');
    channel = null;
    connectionRef = null;
  });
  connection.on('error', (err) => {
    logger.error({ err }, 'RabbitMQ connection error');
  });

  logger.info('Auth service RabbitMQ publisher initialized');
};

export const publishUserRegistered = (payload: AuthUserRegisteredPayload) => {
  if (!channel) {
    logger.warn('RabbitMQ channel is not initialized. Cannot publish message.');
    return;
  }

  const event = {
    type: AUTH_USER_REGISTERED_ROUTING_KEY,
    payload,
    occuredAt: new Date().toISOString(),
    metadata: { version: 1 },
  };

  const ch = channel;

  // Publishes inside a span and carries the W3C trace context in the message
  // headers, so user-service's consumer span joins the same trace.
  void withPublishSpan(
    { exchange: AUTH_EVENT_EXCHANGE, routingKey: AUTH_USER_REGISTERED_ROUTING_KEY },
    (headers) => {
      const published = ch.publish(
        AUTH_EVENT_EXCHANGE,
        AUTH_USER_REGISTERED_ROUTING_KEY,
        Buffer.from(JSON.stringify(event)),
        { contentType: 'application/json', persistent: true, headers },
      );

      if (!published) {
        logger.warn({ event }, 'Failed to publish user registered event');
      }
    },
  ).catch((error: unknown) => {
    logger.error({ err: error }, 'Error publishing user registered event');
  });
};

export const closePublisher = async () => {
  try {
    const ch = channel;
    if (ch) {
      await ch.close();
      channel = null;
    }
    const conn = connectionRef;
    if (conn) {
      await conn.close();
      connectionRef = null;
    }
  } catch (error) {
    logger.error({ err: error }, 'Error closing RabbitMQ connection/channel');
  }
};
