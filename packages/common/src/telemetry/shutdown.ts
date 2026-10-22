const SHUTDOWN_SYMBOL = Symbol.for('chatapp.telemetry.shutdown');

/**
 * Flush and stop the OpenTelemetry SDK (spans, metrics, logs). Safe to call
 * when telemetry is disabled; resolves after at most `timeoutMs`.
 */
export const shutdownTelemetry = async (timeoutMs = 3000): Promise<void> => {
  const fn = (globalThis as Record<symbol, unknown>)[SHUTDOWN_SYMBOL];
  if (typeof fn !== 'function') {
    return;
  }

  await Promise.race([
    (fn as () => Promise<void>)().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs).unref()),
  ]);
};
