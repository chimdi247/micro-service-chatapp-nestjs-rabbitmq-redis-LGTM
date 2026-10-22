import { resolveRouteLabel } from '@chatapp/common';

describe('resolveRouteLabel (metric cardinality guard)', () => {
  it('collapses UUIDs into :id', () => {
    expect(
      resolveRouteLabel('/conversations/6f1c2a5e-8d3b-4c1a-9e7f-0a1b2c3d4e5f/messages?limit=5', true, 200),
    ).toBe('/conversations/:id/messages');
  });

  it('collapses Mongo ObjectIds and numeric ids', () => {
    expect(resolveRouteLabel('/messages/507f1f77bcf86cd799439011', true, 200)).toBe('/messages/:id');
    expect(resolveRouteLabel('/users/42/profile', true, 200)).toBe('/users/:n/profile');
  });

  it('drops the query string', () => {
    expect(resolveRouteLabel('/users/search?query=alice', true, 200)).toBe('/users/search');
  });

  it('buckets unmatched 404s so scanners cannot explode cardinality', () => {
    expect(resolveRouteLabel('/wp-admin/setup.php', false, 404)).toBe('unmatched');
    expect(resolveRouteLabel('/auth/login', true, 404)).toBe('/auth/login');
  });
});
