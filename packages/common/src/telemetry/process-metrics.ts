import { monitorEventLoopDelay } from 'node:perf_hooks';

import { metrics } from '@opentelemetry/api';

let registered = false;

/**
 * Runtime health gauges. `chatapp.process.uptime` also doubles as a liveness
 * signal for services that push (rather than expose) metrics.
 */
export const registerProcessMetrics = (): void => {
  if (registered) {
    return;
  }
  registered = true;

  const meter = metrics.getMeter('chatapp.process');
  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();

  let lastCpu = process.cpuUsage();
  let lastCpuAt = process.hrtime.bigint();

  const uptime = meter.createObservableGauge('chatapp.process.uptime', {
    description: 'Seconds since the process started',
    unit: 's',
  });
  const rss = meter.createObservableGauge('chatapp.process.memory.rss', {
    description: 'Resident set size',
    unit: 'By',
  });
  const heapUsed = meter.createObservableGauge('chatapp.process.memory.heap_used', {
    description: 'V8 heap used',
    unit: 'By',
  });
  const cpu = meter.createObservableGauge('chatapp.process.cpu.utilization', {
    description: 'Process CPU time as a fraction of one core since the last export',
    unit: '1',
  });
  const loopP99 = meter.createObservableGauge('chatapp.process.eventloop.delay_p99', {
    description: 'Event loop delay, 99th percentile since the last export',
    unit: 's',
  });

  meter.addBatchObservableCallback(
    (observer) => {
      const now = process.hrtime.bigint();
      const usage = process.cpuUsage();
      const elapsedMicros = Number(now - lastCpuAt) / 1000;
      const usedMicros = usage.user - lastCpu.user + (usage.system - lastCpu.system);
      lastCpu = usage;
      lastCpuAt = now;

      const memory = process.memoryUsage();
      observer.observe(uptime, process.uptime());
      observer.observe(rss, memory.rss);
      observer.observe(heapUsed, memory.heapUsed);
      observer.observe(cpu, elapsedMicros > 0 ? usedMicros / elapsedMicros : 0);
      observer.observe(loopP99, loopDelay.percentile(99) / 1e9);
      loopDelay.reset();
    },
    [uptime, rss, heapUsed, cpu, loopP99],
  );
};
