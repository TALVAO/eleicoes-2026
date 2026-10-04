import { randomUUID } from 'node:crypto';
import { createStore } from './store';
import { Ingestion, log } from './ingestion';
import { TSEClient, RequestGate } from '@/lib/tse/client';
try {
  process.loadEnvFile('.env.local');
} catch (e) {
  if (!(e instanceof Error && 'code' in e && e.code === 'ENOENT')) throw e;
}
const store = createStore(),
  token = randomUUID();
let stopped = false,
  lease = false;
process.on('SIGINT', () => {
  stopped = true;
});
process.on('SIGTERM', () => {
  stopped = true;
});
const client = new TSEClient(
  new RequestGate(Number(process.env.TSE_REQUESTS_PER_SECOND ?? 4)),
  fetch,
  Number(process.env.TSE_TIMEOUT_MS ?? 8000),
  Number(process.env.TSE_MAX_BYTES ?? 20971520),
);
const ingestion = new Ingestion(store, token, client);
let renewal: ReturnType<typeof setInterval> | null = null;
try {
  while (!stopped) {
    if (!lease) {
      lease = await store.acquire(token);
      if (!lease) {
        if (process.argv.includes('--once'))
          throw new Error('Another worker owns the ingestion lease');
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      log('worker.leader');
      renewal = setInterval(() => {
        void store
          .renew(token)
          .then((ok) => {
            if (!ok) {
              stopped = true;
              log('worker.lease-lost');
            }
          })
          .catch((e: unknown) => {
            stopped = true;
            log('worker.cache-unavailable', {
              code: e instanceof Error && 'code' in e ? e.code : null,
            });
          });
      }, 8000);
    }
    await ingestion.tick();
    if (process.argv.includes('--once')) break;
    await new Promise((r) => setTimeout(r, 250));
  }
} catch (e) {
  log('worker.failure', { message: e instanceof Error ? e.message : 'Unknown failure' });
  process.exitCode = 1;
} finally {
  if (renewal) clearInterval(renewal);
  if (lease) await store.release(token).catch(() => {});
  await store.close();
}
