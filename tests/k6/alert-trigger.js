// ALERT TRIGGER: login is bcrypt-bound (CPU heavy), so this pushes auth-service
// past 40% of its 0.5-CPU limit quickly -> fires "Container CPU above 40%" and
// (after the 'for' period) emails via Grafana. Check Mailpit: http://localhost:8025
import { sleep } from 'k6';
import { login, prepareFixtures } from './lib/common.js';

export const options = {
  setupTimeout: '120s',
  scenarios: {
    burn: { executor: 'constant-vus', vus: Number(__ENV.VUS || 30), duration: __ENV.DURATION || '6m' },
  },
};

export const setup = () => prepareFixtures(3);

export default function (data) {
  login(data.users[__VU % data.users.length].email);
  sleep(0.05);
}
