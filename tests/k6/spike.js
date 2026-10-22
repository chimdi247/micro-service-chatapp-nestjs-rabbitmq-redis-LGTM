// SPIKE: sudden surge (e.g. a campaign/push notification), then back to normal.
import { sleep } from 'k6';
import { chatIteration, prepareFixtures } from './lib/common.js';

const SPIKE = Number(__ENV.SPIKE_VUS || 200);

export const options = {
  setupTimeout: '300s',
  stages: [
    { duration: '1m', target: 10 },      // baseline
    { duration: '20s', target: SPIKE },  // spike
    { duration: '1m', target: SPIKE },   // hold
    { duration: '20s', target: 10 },     // drop
    { duration: '3m', target: 10 },      // recovery: latency must return to baseline
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2500'],
  },
};

export const setup = () => prepareFixtures(20);

export default function (data) {
  chatIteration(data);
  sleep(Math.random() * 0.5);
}
