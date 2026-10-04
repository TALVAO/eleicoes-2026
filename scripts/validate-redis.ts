import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { createStore } from '../src/server/store';

// This destructive leadership test is restricted to an isolated local Redis database.
const endpoint = new URL(process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6386/15');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Local Redis required');
assert.equal(endpoint.protocol, 'redis:');
assert.equal(endpoint.pathname, '/15', 'Use isolated validation database 15');
process.env.REDIS_URL = endpoint.href;
const admin = new Redis(endpoint.href, { lazyConnect: true, maxRetriesPerRequest: 1 });
admin.on('error', () => {});
const a = createStore(),
  b = createStore();
const ownerA = randomUUID(),
  ownerB = randomUUID(),
  key = 'validation:' + randomUUID();
let successor = false;
try {
  await admin.connect();
  assert.equal(await admin.get('ele2026:lease'), null, 'Validation DB is already in use');
  // Concurrent first reads exercise cold starts in serverless functions.
  assert.deepEqual(
    await Promise.all(Array.from({ length: 8 }, () => a.get(key))),
    Array(8).fill(null),
  );
  assert.equal(await a.acquire(ownerA), true);
  assert.equal(await b.acquire(ownerB), false);
  await a.put(key, { revision: 'persisted-cache-record' }, ownerA);
  assert.deepEqual(await b.get(key), { revision: 'persisted-cache-record' });
  await assert.rejects(b.put(key, { revision: 'unauthorized' }, ownerB), /Lost ingestion lease/);
  assert.equal(await a.renew(ownerA), true);
  await a.demand(key);
  assert((await b.demands()).includes(key));
  await admin.zadd('ele2026:demands', Date.now() - 1, key);
  assert(!(await a.demands()).includes(key));
  await admin.pexpire('ele2026:lease', 5);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(await b.acquire(ownerB), true);
  successor = true;
  assert.equal(await a.renew(ownerA), false);
  await a.release(ownerA);
  assert.equal(await admin.get('ele2026:lease'), ownerB);
  await assert.rejects(a.put(key, { revision: 'stale-owner' }, ownerA), /Lost ingestion lease/);
  assert.deepEqual(await b.get(key), { revision: 'persisted-cache-record' });
  await b.put(key, { revision: 'successor' }, ownerB);
  assert.deepEqual(await a.get(key), { revision: 'successor' });
  console.log(
    JSON.stringify({
      status: 'passed',
      checks: [
        'cold-start',
        'sharing',
        'fencing',
        'renewal',
        'demand-expiry',
        'lease-expiry',
        'takeover',
        'stale-owner-rejection',
      ],
    }),
  );
} finally {
  await (successor ? b.release(ownerB) : a.release(ownerA)).catch(() => {});
  await admin.del('ele2026:' + key).catch(() => {});
  await admin.zrem('ele2026:demands', key).catch(() => {});
  await Promise.all([a.close(), b.close()]);
  admin.disconnect();
}
