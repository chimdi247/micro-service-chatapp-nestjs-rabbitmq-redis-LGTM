import { loginSchema, refreshSchema, registerSchema, revokeSchema } from '../../services/gateway-service/src/validation/auth.schema';

describe('gateway auth schemas', () => {
  it('accepts a valid registration', () => {
    expect(registerSchema.safeParse({ email: 'a@b.co', password: 'Password123!', displayName: 'Alice' }).success).toBe(true);
  });

  it.each([
    [{ email: 'not-an-email', password: 'Password123!', displayName: 'Alice' }],
    [{ email: 'a@b.co', password: 'short', displayName: 'Alice' }],
    [{ email: 'a@b.co', password: 'Password123!', displayName: 'Al' }],
    [{ email: 'a@b.co', password: 'Password123!', displayName: 'x'.repeat(31) }],
  ])('rejects invalid registration %#', (input) => {
    expect(registerSchema.safeParse(input).success).toBe(false);
  });

  it('validates login, refresh and revoke payloads', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'Password123!' }).success).toBe(true);
    expect(refreshSchema.safeParse({}).success).toBe(false);
    expect(revokeSchema.safeParse({ userId: 'not-a-uuid' }).success).toBe(false);
  });
});
