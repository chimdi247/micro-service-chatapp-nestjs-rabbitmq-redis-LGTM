import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('chatapp.business');

/**
 * Business KPI instruments. Names are deliberately explicit because the
 * Grafana dashboards and alert rules query them
 * (Prometheus form: dots become underscores, e.g. chatapp_messages_sent).
 */
export const appMetrics = {
  usersRegistered: meter.createCounter('chatapp.users.registered', {
    description: 'Accounts successfully registered',
    unit: '{user}',
  }),
  authLogins: meter.createCounter('chatapp.auth.logins', {
    description: 'Login attempts by outcome (success | invalid_credentials)',
    unit: '{attempt}',
  }),
  authTokenRefreshes: meter.createCounter('chatapp.auth.token_refreshes', {
    description: 'Refresh-token exchanges by outcome',
    unit: '{attempt}',
  }),
  conversationsCreated: meter.createCounter('chatapp.conversations.created', {
    description: 'Conversations created',
    unit: '{conversation}',
  }),
  messagesSent: meter.createCounter('chatapp.messages.sent', {
    description: 'Chat messages persisted',
    unit: '{message}',
  }),
  cacheRequests: meter.createCounter('chatapp.cache.requests', {
    description: 'Cache lookups by cache name and result (hit | miss)',
    unit: '{request}',
  }),
  eventsPublished: meter.createCounter('chatapp.events.published', {
    description: 'Domain events published to RabbitMQ',
    unit: '{event}',
  }),
  eventsConsumed: meter.createCounter('chatapp.events.consumed', {
    description: 'Domain events consumed from RabbitMQ by outcome',
    unit: '{event}',
  }),
  eventProcessingDuration: meter.createHistogram('chatapp.events.processing.duration', {
    description: 'Time to process a consumed domain event',
    unit: 's',
  }),
};
