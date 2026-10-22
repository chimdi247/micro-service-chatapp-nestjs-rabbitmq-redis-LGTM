// SMOKE: 1 VU, one full functional journey. Run after every deploy.
//   k6 run tests/k6/smoke.js            (or see tests/README.md for docker)
import { check, group, sleep } from 'k6';
import {
  createConversation, health, listConversations, listMessages, login, registerUser, searchUsers, sendMessage,
} from './lib/common.js';

export const options = {
  vus: 1,
  duration: __ENV.SMOKE_DURATION || '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  group('health', () => health());

  let alice;
  let bob;
  group('register', () => {
    alice = registerUser('smoke-a');
    bob = registerUser('smoke-b');
  });
  if (!alice || !bob) return;

  group('login', () => {
    const res = login(alice.email);
    check(res, { 'login 200': (r) => r.status === 200, 'has token': (r) => !!r.json('accessToken') });
  });

  // user.created travels auth -> RabbitMQ -> user-service -> RabbitMQ -> chat-service
  sleep(2);

  group('chat', () => {
    group('search', () => searchUsers(alice.token, 'K6'));
    const convo = createConversation(alice.token, [bob.id], 'smoke');
    if (!convo) return;
    sendMessage(alice.token, convo.id, 'hello from the smoke test');
    sendMessage(bob.token, convo.id, 'hello back');
    const res = listMessages(alice.token, convo.id);
    check(res, { 'two messages stored': (r) => r.json('data').length === 2 });
    listConversations(bob.token);
  });

  sleep(1);
}
