import http from 'k6/http';
import { check, fail } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
export const PASSWORD = 'Password123!';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Count 4xx/5xx as failures (http_req_failed) unless a request opts out.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }));

export function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function authHeaders(token) {
  return { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } };
}

function tag(name) {
  return { tags: { name } };
}

// ----------------------------------------------------------------------------- API calls
export function registerUser(prefix = 'k6') {
  const id = uid();
  const res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email: `${prefix}.${id}@loadtest.local`, password: PASSWORD, displayName: `K6 ${id}`.slice(0, 30) }),
    { headers: JSON_HEADERS, ...tag('POST /auth/register') },
  );
  check(res, { 'register 201': (r) => r.status === 201 });
  if (res.status !== 201) return null;
  const body = res.json();
  return { id: body.user.id, email: body.user.email, token: body.accessToken, refreshToken: body.refreshToken };
}

export function login(email, password = PASSWORD) {
  return http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, password }), {
    headers: JSON_HEADERS,
    ...tag('POST /auth/login'),
  });
}

export function createConversation(token, participantIds, title) {
  const res = http.post(`${BASE_URL}/conversations`, JSON.stringify({ participantIds, title }), {
    ...authHeaders(token),
    ...tag('POST /conversations'),
  });
  check(res, { 'conversation 201': (r) => r.status === 201 });
  return res.status === 201 ? res.json().data : null;
}

export function sendMessage(token, conversationId, body) {
  const res = http.post(`${BASE_URL}/conversations/${conversationId}/messages`, JSON.stringify({ body }), {
    ...authHeaders(token),
    ...tag('POST /conversations/:id/messages'),
  });
  check(res, { 'message 201': (r) => r.status === 201 });
  return res;
}

export function listMessages(token, conversationId) {
  const res = http.get(`${BASE_URL}/conversations/${conversationId}/messages?limit=50`, {
    ...authHeaders(token),
    ...tag('GET /conversations/:id/messages'),
  });
  check(res, { 'messages 200': (r) => r.status === 200 });
  return res;
}

export function listConversations(token) {
  const res = http.get(`${BASE_URL}/conversations`, { ...authHeaders(token), ...tag('GET /conversations') });
  check(res, { 'conversations 200': (r) => r.status === 200 });
  return res;
}

export function searchUsers(token, query) {
  const res = http.get(`${BASE_URL}/users/search?query=${encodeURIComponent(query)}`, {
    ...authHeaders(token),
    ...tag('GET /users/search'),
  });
  check(res, { 'search 200': (r) => r.status === 200 });
  return res;
}

export function health() {
  const res = http.get(`${BASE_URL}/health`, tag('GET /health'));
  check(res, { 'gateway healthy': (r) => r.status === 200 });
  return res;
}

// ----------------------------------------------------------------------------- shared setup
/**
 * Registers `count` users and pairs them into conversations so the VUs can
 * exercise the read/write paths without paying registration (bcrypt) cost on
 * every iteration. Returns plain JSON (k6 passes it to every VU).
 */
export function prepareFixtures(count = 10) {
  health();
  const users = [];
  for (let i = 0; i < count; i += 1) {
    const u = registerUser('fixture');
    if (u) users.push(u);
  }
  if (users.length < 2) fail('could not prepare fixture users - is the stack up?');

  const conversations = [];
  for (let i = 0; i < users.length; i += 1) {
    const a = users[i];
    const b = users[(i + 1) % users.length];
    const c = createConversation(a.token, [b.id], `fixture-${i}`);
    if (c) conversations.push({ id: c.id, ownerIndex: i, participantIndex: (i + 1) % users.length });
  }
  return { users, conversations };
}

/** One realistic "chat session" iteration (reads dominate, like real traffic). */
export function chatIteration(data, { loginRatio = 0.02, registerRatio = 0.01 } = {}) {
  const roll = Math.random();

  if (roll < registerRatio) {
    registerUser('iter');
    return;
  }

  const convo = data.conversations[Math.floor(Math.random() * data.conversations.length)];
  const user = data.users[convo.ownerIndex];

  if (roll < registerRatio + loginRatio) {
    login(user.email);
    return;
  }

  listConversations(user.token);
  listMessages(user.token, convo.id);
  if (Math.random() < 0.5) sendMessage(user.token, convo.id, `load message ${uid()}`);
  if (Math.random() < 0.2) searchUsers(user.token, 'fixture');
}
