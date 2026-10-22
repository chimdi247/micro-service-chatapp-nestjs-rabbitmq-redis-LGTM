import { config } from '../lib/config';

/** Waits (up to ~3 min) for the gateway so tests can run right after `docker compose up`. */
export default async function setup(): Promise<void> {
  const deadline = Date.now() + 180_000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${config.gateway}/health`);
      if (res.ok) return;
      lastError = `status ${res.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Gateway ${config.gateway} not healthy: ${lastError}. Is the stack running (docker compose up)?`);
}
