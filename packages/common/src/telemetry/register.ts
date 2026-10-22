/**
 * OpenTelemetry bootstrap -- MUST be loaded before any application code:
 *
 *   node --import @chatapp/common/dist/telemetry/register.js dist/index.js
 *
 * Why this file is tiny and uses a dynamic import:
 *   The services are native ESM. Auto-instrumentation of CommonJS libraries
 *   (express, pg, mysql2, ioredis, amqplib, ...) works through
 *   require-in-the-middle, but ESM->CJS imports additionally need the
 *   import-in-the-middle loader hook. The hook has to be registered BEFORE the
 *   SDK / instrumentation modules (and the app) are evaluated, so the heavy
 *   imports live in ./sdk.js and are pulled in only after register() ran.
 */
import { register } from 'node:module';

if (process.env.OTEL_SDK_DISABLED !== 'true') {
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

  const { startTelemetry } = await import('./sdk.js');
  startTelemetry();
}
