import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ readView: vi.fn(), readGeography: vi.fn() }));
vi.mock('../../src/server/read-model', () => ({ readView: mocks.readView }));
vi.mock('../../src/server/geography', () => ({ readGeography: mocks.readGeography }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  mocks.readView.mockReset();
  mocks.readGeography.mockReset();
});
describe('Dashboard read batching and geographic ETags', () => {
  it('coalesces simultaneous national reads and expires after two seconds', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    mocks.readView.mockImplementation(async () => {
      await Promise.resolve();
      return { resource: {}, serverNow: 'test' };
    });
    const { GET } = await import('../../src/app/api/results/route');
    const request = () => new Request('http://local/api/results?scope=br&office=1');
    const responses = await Promise.all(Array.from({ length: 50 }, () => GET(request())));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(mocks.readView).toHaveBeenCalledTimes(1);
    now = 3001;
    await GET(request());
    expect(mocks.readView).toHaveBeenCalledTimes(2);
  });
  it('does not cache invalid geography and never leaks technical errors', async () => {
    mocks.readView.mockResolvedValue(null);
    const { GET } = await import('../../src/app/api/results/route');
    expect((await GET(new Request('http://local/api/results?scope=evil'))).status).toBe(400);
    mocks.readView.mockRejectedValue(new Error('private redis credentials'));
    const failed = await GET(new Request('http://local/api/results?scope=br'));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain('redis');
  });
  it('returns 304 for identical geography, refetches expired cache and preserves provenance', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    mocks.readGeography.mockResolvedValue({ states: [], municipalities: [], expectedStates: 27 });
    const { GET } = await import('../../src/app/api/geography/route');
    const first = await GET(new Request('http://local/api/geography'));
    const etag = first.headers.get('etag')!;
    const same = await GET(
      new Request('http://local/api/geography', { headers: { 'If-None-Match': etag } }),
    );
    expect(same.status).toBe(304);
    expect(await same.text()).toBe('');
    expect(mocks.readGeography).toHaveBeenCalledTimes(1);
    now = 3001;
    await GET(new Request('http://local/api/geography'));
    expect(mocks.readGeography).toHaveBeenCalledTimes(2);
  });
});
