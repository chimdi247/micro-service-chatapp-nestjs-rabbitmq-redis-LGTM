// STRESS: step the load well past normal to find where latency/errors degrade
// and how the system recovers. Watch CPU/memory alerts and pool saturation.
import { sleep } from 'k6';
import { chatIteration, prepareFixtures } from './lib/common.js';

export const options = {
  setupTimeout: '300s',
  stages: [
    { duration: '2m', target: 20 },
    { duration: '3m', target: 50 },
    { duration: '3m', target: 100 },
    { duration: '3m', target: 150 },
    { duration: '3m', target: 200 },
    { duration: '3m', target: 0 }, // recovery
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<3000'],
  },
};

export const setup = () => prepareFixtures(20);

export default function (data) {
  chatIteration(data, { loginRatio: 0.05, registerRatio: 0.02 });
  sleep(Math.random());
}
