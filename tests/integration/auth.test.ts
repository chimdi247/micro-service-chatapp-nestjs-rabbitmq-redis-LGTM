import { api, registerUser, unique } from '../lib/api';
import { config } from '../lib/config';

describe('auth flow (gateway -> auth-service -> MySQL via ProxySQL)', () => {
  it('registers, rejects duplicates, logs in and refreshes', async () => {
    const user = await registerUser('auth');

    const duplicate = await api('/auth/register', {
      body: { email: user.email, password: config.password, displayName: user.displayName },
    });
    expect(duplicate.status).toBe(409);

    const login = await api('/auth/login', { body: { email: user.email, password: config.password } });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();

    const refreshed = await api('/auth/refresh', { body: { refreshToken: login.body.refreshToken } });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
  });

  it('rejects wrong credentials with 401', async () => {
    const user = await registerUser('auth');
    const res = await api('/auth/login', { body: { email: user.email, password: 'definitely-wrong' } });
    expect(res.status).toBe(401);
  });

  it('validates input (422) and protects private routes (401)', async () => {
    const invalid = await api('/auth/register', { body: { email: 'nope', password: 'x', displayName: 'a' } });
    expect(invalid.status).toBe(422);

    const unauthenticated = await api('/conversations');
    expect(unauthenticated.status).toBe(401);
  });

  it('sets a unique email per run', () => {
    expect(unique()).not.toEqual(unique());
  });
});
