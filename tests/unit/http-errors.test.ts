import { HttpError, createInternalAuthMiddleware, validateRequest, z } from '@chatapp/common';

const runMiddleware = (mw: (...args: any[]) => void, req: any) =>
  new Promise<unknown>((resolve) => mw(req, {}, (err?: unknown) => resolve(err)));

describe('HttpError', () => {
  it('keeps status code, message and details', () => {
    const error = new HttpError(409, 'Conflict', { field: 'email' });
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(409);
    expect(error.details).toEqual({ field: 'email' });
  });
});

describe('createInternalAuthMiddleware', () => {
  const mw = createInternalAuthMiddleware('secret', { exemptPaths: ['/health'] });

  it('allows the exempt health path without a token', async () => {
    expect(await runMiddleware(mw, { path: '/health', headers: {} })).toBeUndefined();
  });

  it('rejects a missing or wrong token with 401', async () => {
    const missing = (await runMiddleware(mw, { path: '/users', headers: {} })) as HttpError;
    const wrong = (await runMiddleware(mw, { path: '/users', headers: { 'x-internal-token': 'nope' } })) as HttpError;
    expect(missing.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
  });

  it('accepts the correct token', async () => {
    expect(await runMiddleware(mw, { path: '/users', headers: { 'x-internal-token': 'secret' } })).toBeUndefined();
  });
});

describe('validateRequest', () => {
  const mw = validateRequest({ body: z.object({ email: z.string().email() }) });

  it('passes valid bodies through', async () => {
    const req: any = { body: { email: 'a@b.co' } };
    expect(await runMiddleware(mw, req)).toBeUndefined();
  });

  it('turns schema failures into a 422 with issues', async () => {
    const err = (await runMiddleware(mw, { body: { email: 'nope' } })) as HttpError;
    expect(err.statusCode).toBe(422);
    expect(JSON.stringify(err.details)).toContain('email');
  });
});
