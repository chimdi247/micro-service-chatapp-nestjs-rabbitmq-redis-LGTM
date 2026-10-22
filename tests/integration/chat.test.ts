import { api, eventually, registerUser } from '../lib/api';

describe('chat flow (users sync over RabbitMQ, messages in MongoDB, cache in Redis)', () => {
  it('syncs a new user to user-service and supports a full conversation', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');

    // auth-service -> RabbitMQ -> user-service (eventual consistency)
    await eventually(
      async () => {
        const res = await api(`/users/search?query=${encodeURIComponent(bob.displayName.slice(0, 6))}`, { token: alice.accessToken });
        return res.status === 200 && JSON.stringify(res.body).includes(bob.id) ? res : null;
      },
      { label: 'bob to appear in user search (auth.user.registered consumed)' },
    );

    const created = await api('/conversations', { body: { participantIds: [bob.id], title: 'it' }, token: alice.accessToken });
    expect(created.status).toBe(201);
    const conversationId = created.body.data.id;

    const sent = await api(`/conversations/${conversationId}/messages`, { body: { body: 'hello bob' }, token: alice.accessToken });
    expect(sent.status).toBe(201);

    const reply = await api(`/conversations/${conversationId}/messages`, { body: { body: 'hi alice' }, token: bob.accessToken });
    expect(reply.status).toBe(201);

    const list = await api(`/conversations/${conversationId}/messages`, { token: alice.accessToken });
    expect(list.status).toBe(200);
    expect(list.body.data.map((m: { body: string }) => m.body)).toEqual(expect.arrayContaining(['hello bob', 'hi alice']));

    // Second read is served through the Redis-backed conversation cache.
    const again = await api(`/conversations/${conversationId}`, { token: bob.accessToken });
    expect(again.status).toBe(200);
  });

  it('forbids non-participants (403)', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const mallory = await registerUser('mallory');

    await eventually(async () => {
      const res = await api(`/users/search?query=${encodeURIComponent(bob.displayName.slice(0, 6))}`, { token: alice.accessToken });
      return JSON.stringify(res.body).includes(bob.id);
    }, { label: 'bob to be searchable' });

    const created = await api('/conversations', { body: { participantIds: [bob.id] }, token: alice.accessToken });
    const res = await api(`/conversations/${created.body.data.id}/messages`, { body: { body: 'let me in' }, token: mallory.accessToken });
    expect([403, 404]).toContain(res.status);
  });
});
