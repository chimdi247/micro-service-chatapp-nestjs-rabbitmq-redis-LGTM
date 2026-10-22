// LOAD: expected production traffic, sustained. Establishes the performance baseline.
//   VUS=20 HOLD=5m k6 run tests/k6/load.js
import { sleep } from 'k6';
import { chatIteration, prepareFixtures } from './lib/common.js';

const VUS = Number(__ENV.VUS || 20);

export const options = {
  setupTimeout: '300s',
  stages: [
    { duration: __ENV.RAMP || '1m', target: VUS },
    { duration: __ENV.HOLD || '5m', target: VUS },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    'http_req_duration{name:POST /conversations/:id/messages}': ['p(95)<800'],
    checks: ['rate>0.99'],
  },
};

export const setup = () => prepareFixtures(Number(__ENV.FIXTURE_USERS || 10));

export default function (data) {
  chatIteration(data);
  sleep(Math.random() * 2 + 0.5);
}
