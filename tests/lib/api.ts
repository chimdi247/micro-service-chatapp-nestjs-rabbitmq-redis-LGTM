import { randomBytes } from 'node:crypto';

import { config } from './config';

export interface TestUser {
  id: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
}

export const unique = (): string => randomBytes(5).toString('hex');

export const api = async (
  path: string,
  init: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> => {
  const response = await fetch(`${config.gateway}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      'content-type': 'application/json',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await response.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    /* non-JSON body */
  }
  return { status: response.status, body };
};

export const registerUser = async (
  prefix = 'it',
  headers: Record<string, string> = {},
): Promise<TestUser> => {
  const id = unique();
  const displayName = `${prefix} ${id}`.slice(0, 30);
  const email = `${prefix}.${id}@integration.local`;
  const res = await api('/auth/register', {
    body: { email, password: config.password, displayName },
    headers,
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    id: res.body.user.id,
    email,
    displayName,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `fn` until it returns a truthy value (eventual consistency over RabbitMQ). */
export const eventually = async <T>(
  fn: () => Promise<T | undefined | false | null>,
  { timeoutMs = 45_000, intervalMs = 1_000, label = 'condition' } = {},
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${String(lastError)}` : ''}`);
};
