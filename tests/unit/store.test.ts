import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createStore, type Store } from '../../src/server/store';
let folder: string | null = null;
const stores: Store[] = [];
const previous = process.env.CACHE_DIR;
afterEach(async () => {
  await Promise.all(stores.splice(0).map((s) => s.close()));
  if (folder) {
    const target = resolve(folder),
      workspace = resolve('.');
    if (!target.startsWith(workspace + sep)) throw new Error('Unsafe test cleanup');
    await rm(target, { recursive: true, force: true });
    folder = null;
  }
  if (previous === undefined) delete process.env.CACHE_DIR;
  else process.env.CACHE_DIR = previous;
});
describe('Local durable cache and leadership fencing', () => {
  it('maintains complete JSON under concurrent reads, snapshot writes and renewals', async () => {
    folder = await mkdtemp(resolve('.cache-test-'));
    process.env.CACHE_DIR = folder;
    const a = createStore(),
      b = createStore();
    stores.push(a, b);
    await a.acquire('worker');
    await Promise.all([
      (async () => {
        for (let i = 0; i < 40; i++) expect(await a.renew('worker')).toBe(true);
      })(),
      (async () => {
        for (let i = 0; i < 80; i++) await a.put('health', { heartbeat: i }, 'worker');
      })(),
      (async () => {
        for (let i = 0; i < 160; i++) {
          const v = await b.get<{ heartbeat: number }>('health');
          if (v) expect(Number.isInteger(v.heartbeat)).toBe(true);
        }
      })(),
    ]);
    expect(await b.get('health')).toEqual({ heartbeat: 79 });
  });
  it('preserves records across instances and rejects stale-owner writes', async () => {
    folder = await mkdtemp(resolve('.cache-test-'));
    process.env.CACHE_DIR = folder;
    const a = createStore(),
      b = createStore();
    stores.push(a, b);
    expect(await a.acquire('worker-a')).toBe(true);
    expect(await b.acquire('worker-b')).toBe(false);
    await a.put('snapshot', { hash: 'official-hash', votes: 0 }, 'worker-a');
    expect(await b.get('snapshot')).toEqual({ hash: 'official-hash', votes: 0 });
    await expect(b.put('snapshot', { votes: 99 }, 'worker-b')).rejects.toThrow(
      'Lost ingestion lease',
    );
    expect(await a.renew('worker-a')).toBe(true);
    await a.release('worker-a');
    expect(await b.acquire('worker-b')).toBe(true);
    await expect(a.put('snapshot', { votes: 98 }, 'worker-a')).rejects.toThrow(
      'Lost ingestion lease',
    );
    expect(await b.get('snapshot')).toEqual({ hash: 'official-hash', votes: 0 });
  });
  it('records valid demand separately from snapshots and treats absence as null', async () => {
    folder = await mkdtemp(resolve('.cache-test-'));
    process.env.CACHE_DIR = folder;
    const a = createStore();
    stores.push(a);
    expect(await a.get('not-published')).toBeNull();
    await a.demand('6257:ac:01120:1');
    expect(await a.demands()).toContain('6257:ac:01120:1');
  });
});
