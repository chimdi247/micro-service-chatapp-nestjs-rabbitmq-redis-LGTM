// POOL SATURATION: hammer chat-service's read/write paths with far more
// concurrency than MONGO_MAX_POOL_SIZE so the "Connection pools" dashboard
// shows % in use -> 100 and clients waiting. Lower MONGO_MAX_POOL_SIZE in .env
// (e.g. 5) to see it with fewer VUs.
import { listMessages, prepareFixtures, sendMessage, uid } from './lib/common.js';

export const options = {
  setupTimeout: '300s',
  scenarios: {
    saturate: { executor: 'constant-vus', vus: Number(__ENV.VUS || 100), duration: __ENV.DURATION || '3m' },
  },
  thresholds: { http_req_failed: ['rate<0.2'] },
};

export const setup = () => prepareFixtures(10);

export default function (data) {
  const convo = data.conversations[__VU % data.conversations.length];
  const user = data.users[convo.ownerIndex];
  sendMessage(user.token, convo.id, `pool ${uid()}`);
  listMessages(user.token, convo.id);
}
