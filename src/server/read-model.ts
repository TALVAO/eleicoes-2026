import { emptyResource } from '@/lib/tse/cache';
import type { Catalog, Resource, Result, UpdateEvent, View, WorkerHealth } from '@/lib/tse/types';
import { getStore } from './store';
import { resolveQuery } from './query';
export async function readCatalog() {
  return getStore().get<Catalog>('catalog');
}
export async function readView(params: URLSearchParams): Promise<View | null> {
  const store = getStore(),
    catalog = await readCatalog();
  const releaseAt = catalog
    ? `${catalog.date.split('/').reverse().join('-')}T17:00:00-03:00`
    : '2026-10-04T17:00:00-03:00';
  const serverNow = new Date().toISOString();
  const transport = process.env.LIVE_TRANSPORT === 'polling' ? 'polling' : 'sse';
  if (!catalog)
    return {
      resource: { ...emptyResource<Result>(), status: 'configuration-unavailable' },
      events: [],
      health: await store.get<WorkerHealth>('health'),
      releaseAt,
      serverNow,
      transport,
    };
  const q = resolveQuery(catalog, params);
  if (!q) return null;
  await store.demand(q.key);
  const [resource, events, health] = await Promise.all([
    store.get<Resource<Result>>('result:' + q.key),
    store.get<UpdateEvent[]>('events'),
    store.get<WorkerHealth>('health'),
  ]);
  return {
    resource: resource ?? emptyResource<Result>(),
    events: (events ?? []).filter((e) => e.key === q.key),
    health,
    releaseAt,
    serverNow,
    transport,
  };
}
