// BREAKPOINT: ramp request RATE (open model) until thresholds fail; k6 then
// aborts and the last stable rate is your capacity. Don't run against prod.
import { chatIteration, prepareFixtures } from './lib/common.js';

export const options = {
  setupTimeout: '300s',
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [{ duration: __ENV.BREAKPOINT_DURATION || '15m', target: Number(__ENV.MAX_RPS || 400) }],
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: [{ threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

export const setup = () => prepareFixtures(20);

export default function (data) {
  chatIteration(data);
}
