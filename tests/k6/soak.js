// SOAK: moderate load for hours -> memory leaks, connection-pool leaks, disk
// growth, slow degradation. Watch memory %, event-loop lag, pool "in use".
//   SOAK_DURATION=4h SOAK_VUS=15 k6 run tests/k6/soak.js
import { sleep } from 'k6';
import { chatIteration, prepareFixtures } from './lib/common.js';

export const options = {
  setupTimeout: '300s',
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: Number(__ENV.SOAK_VUS || 15),
      duration: __ENV.SOAK_DURATION || '2h',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export const setup = () => prepareFixtures(15);

export default function (data) {
  chatIteration(data);
  sleep(Math.random() * 2 + 1);
}
