import { metrics } from '@opentelemetry/api';

/**
 * Driver-side connection pool metrics, one shape for every datastore so a
 * single dashboard can show MongoDB's driver pool next to Sequelize's pools:
 *
 *   chatapp_db_pool_connections{state="in_use|idle|total"}
 *   chatapp_db_pool_pending_requests        callers waiting for a connection
 *   chatapp_db_pool_max_connections
 *   chatapp_db_pool_checkout_failures       (counter, by reason)
 */
export interface PoolSnapshot {
  /** Connections currently open to the server. */
  total: number;
  /** Connections currently checked out by application code. */
  inUse: number;
  /** Open but idle connections. */
  idle: number;
  /** Callers blocked waiting for a free connection. */
  pending: number;
  /** Configured upper bound. */
  max: number;
}

interface PoolReader {
  system: string;
  name: string;
  read: () => PoolSnapshot | undefined;
}

const meter = metrics.getMeter('chatapp.db.pool');
const readers = new Map<string, PoolReader>();

const connections = meter.createObservableGauge('chatapp.db.pool.connections', {
  description: 'Pooled connections by state',
  unit: '{connection}',
});
const pending = meter.createObservableGauge('chatapp.db.pool.pending_requests', {
  description: 'Requests waiting for a pooled connection',
  unit: '{request}',
});
const maxConnections = meter.createObservableGauge('chatapp.db.pool.max_connections', {
  description: 'Configured maximum pool size',
  unit: '{connection}',
});
const checkoutFailures = meter.createCounter('chatapp.db.pool.checkout_failures', {
  description: 'Failed attempts to check a connection out of the pool',
  unit: '{failure}',
});

meter.addBatchObservableCallback(
  (observer) => {
    for (const { system, name, read } of readers.values()) {
      const snapshot = read();
      if (!snapshot) {
        continue;
      }
      const base = { 'db.system': system, 'db.pool.name': name };
      observer.observe(connections, snapshot.inUse, { ...base, state: 'in_use' });
      observer.observe(connections, snapshot.idle, { ...base, state: 'idle' });
      observer.observe(connections, snapshot.total, { ...base, state: 'total' });
      observer.observe(pending, snapshot.pending, base);
      observer.observe(maxConnections, snapshot.max, base);
    }
  },
  [connections, pending, maxConnections],
);

export const registerDbPool = (
  system: string,
  name: string,
  read: () => PoolSnapshot | undefined,
): void => {
  readers.set(`${system}:${name}`, { system, name, read });
};

export const recordPoolCheckoutFailure = (system: string, name: string, reason: string): void => {
  checkoutFailures.add(1, { 'db.system': system, 'db.pool.name': name, reason });
};

// ---------------------------------------------------------------------------
// MongoDB: built from the driver's CMAP (connection monitoring and pooling)
// events, which every MongoClient emits without extra configuration.
// ---------------------------------------------------------------------------
interface CmapEvent {
  address?: string;
  reason?: string;
  options?: { maxPoolSize?: number };
}

interface CmapEmitter {
  on(event: string, listener: (event: CmapEvent) => void): unknown;
}

interface MongoPoolState {
  total: number;
  inUse: number;
  pending: number;
  max: number;
}

export const registerMongoPoolMetrics = (client: unknown, options: { maxPoolSize: number }): void => {
  const emitter = client as CmapEmitter;
  const pools = new Map<string, MongoPoolState>();

  const state = (address: string | undefined): MongoPoolState => {
    const key = address ?? 'unknown';
    let current = pools.get(key);
    if (!current) {
      current = { total: 0, inUse: 0, pending: 0, max: options.maxPoolSize };
      pools.set(key, current);
      registerDbPool('mongodb', key, () => {
        const s = pools.get(key);
        return s
          ? {
              total: s.total,
              inUse: s.inUse,
              idle: Math.max(s.total - s.inUse, 0),
              pending: s.pending,
              max: s.max,
            }
          : undefined;
      });
    }
    return current;
  };
  const dec = (n: number) => Math.max(n - 1, 0);

  emitter.on('connectionPoolCreated', (e) => {
    const s = state(e.address);
    s.max = e.options?.maxPoolSize ?? options.maxPoolSize;
  });
  emitter.on('connectionPoolClosed', (e) => {
    pools.delete(e.address ?? 'unknown');
    readers.delete(`mongodb:${e.address ?? 'unknown'}`);
  });
  emitter.on('connectionCreated', (e) => {
    state(e.address).total += 1;
  });
  emitter.on('connectionClosed', (e) => {
    const s = state(e.address);
    s.total = dec(s.total);
  });
  emitter.on('connectionCheckOutStarted', (e) => {
    state(e.address).pending += 1;
  });
  emitter.on('connectionCheckedOut', (e) => {
    const s = state(e.address);
    s.pending = dec(s.pending);
    s.inUse += 1;
  });
  emitter.on('connectionCheckOutFailed', (e) => {
    const s = state(e.address);
    s.pending = dec(s.pending);
    recordPoolCheckoutFailure('mongodb', e.address ?? 'unknown', e.reason ?? 'unknown');
  });
  emitter.on('connectionCheckedIn', (e) => {
    const s = state(e.address);
    s.inUse = dec(s.inUse);
  });
};

// ---------------------------------------------------------------------------
// Sequelize (mysql2 / pg): reads sequelize-pool's live counters.
// ---------------------------------------------------------------------------
interface SequelizePoolLike {
  size: number;
  available: number;
  using: number;
  waiting: number;
  maxSize: number;
}

export const registerSequelizePoolMetrics = (
  sequelize: unknown,
  system: 'mysql' | 'postgresql',
  name: string,
): void => {
  registerDbPool(system, name, () => {
    const pool = (sequelize as { connectionManager?: { pool?: SequelizePoolLike } })
      .connectionManager?.pool;
    if (!pool) {
      return undefined;
    }
    return {
      total: pool.size,
      inUse: pool.using,
      idle: pool.available,
      pending: pool.waiting,
      max: pool.maxSize,
    };
  });
};
