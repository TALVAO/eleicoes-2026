import { describe, it, expect, vi } from 'vitest';
import { Ingestion } from '../../src/server/ingestion';
import { TSEClient, RequestGate } from '../../src/lib/tse/client';
import type { Store } from '../../src/server/store';
import type { WorkerHealth } from '../../src/lib/tse/types';
function memoryStore(values: Map<string, unknown>): Store {
  return {
    get: async <T>(key: string) => (values.get(key) as T) ?? null,
    put: async (key, value) => {
      values.set(key, value);
    },
    demand: async () => {},
    demands: async () => [],
    acquire: async () => true,
    renew: async () => true,
    release: async () => {},
    close: async () => {},
  };
}
describe('Global TSE cooldown survives leadership restart', () => {
  it('sends no outbound request while the durable cooldown is active and keeps heartbeat alive', async () => {
    const until = Date.now() + 600_000,
      values = new Map<string, unknown>([['tse:block-until', until]]);
    const fetcher = vi.fn(),
      worker = new Ingestion(
        memoryStore(values),
        'test-leader',
        new TSEClient(new RequestGate(), fetcher),
      );
    await worker.tick();
    await worker.tick();
    expect(fetcher).not.toHaveBeenCalled();
    const health = values.get('health') as WorkerHealth;
    expect(health.sourceStatus).toBe('rate-limited');
    expect(health.pollingStatus).toBe('backoff');
    expect(health.nextPollAt).toBe(new Date(until).toISOString());
    expect(health.heartbeatAt).not.toBeNull();
  });
  it('persists a new 429 before another resource or restart can retry', async () => {
    const values = new Map<string, unknown>(),
      fetcher = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 429, headers: { 'Retry-After': '900' } }));
    const worker = new Ingestion(
      memoryStore(values),
      'test-leader',
      new TSEClient(new RequestGate(), fetcher),
    );
    await worker.tick();
    await worker.tick();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(Number(values.get('tse:block-until'))).toBeGreaterThan(Date.now() + 800_000);
    const second = vi.fn();
    await new Ingestion(
      memoryStore(values),
      'replacement',
      new TSEClient(new RequestGate(), second),
    ).tick();
    expect(second).not.toHaveBeenCalled();
  });
});
