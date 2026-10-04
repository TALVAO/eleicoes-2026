import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { RequestGate, TSEClient, retryAfter } from '../../src/lib/tse/client';
import { pollDelay } from '../../src/lib/tse/polling';
import { sseFrame, viewRevision } from '../../src/lib/tse/sse';
import { emptyResource } from '../../src/lib/tse/cache';
import type { Provenance, View } from '../../src/lib/tse/types';
const url = 'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json';
const meta: Provenance = {
  url,
  generatedAt: null,
  fetchedAt: '2026-10-04T20:00:00Z',
  etag: '"abc"',
  lastModified: 'Sun, 04 Oct 2026 20:00:00 GMT',
  hash: 'a',
  validation: 'schema-verified',
};
const client = (response: Response) =>
  new TSEClient(new RequestGate(), vi.fn().mockResolvedValue(response), 100, 1024);
describe('Conditional transport and failure policy', () => {
  it('rejects invalid environment budgets instead of disabling transport safeguards', () => {
    expect(() => new RequestGate(NaN)).toThrow();
    expect(() => new RequestGate(100)).toThrow();
    expect(() => new TSEClient(new RequestGate(), fetch, NaN)).toThrow();
    expect(() => new TSEClient(new RequestGate(), fetch, 8000, NaN)).toThrow();
  });
  it('uses conditional validators and handles 304 without parsing a body', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 304 }));
    const c = new TSEClient(new RequestGate(), fetcher);
    expect(await c.get(url, z.object({}), meta)).toEqual({ unchanged: true });
    expect(fetcher.mock.calls[0][1].headers).toMatchObject({
      'If-None-Match': '"abc"',
      'If-Modified-Since': meta.lastModified,
    });
  });
  it('rejects unsolicited 304 with no trusted cache', async () =>
    await expect(
      client(new Response(null, { status: 304 })).get(url, z.object({})),
    ).rejects.toMatchObject({ status: 'upstream-error' }));
  it.each([
    [404, 'unpublished'],
    [429, 'rate-limited'],
    [500, 'upstream-error'],
    [503, 'upstream-error'],
  ])(
    'classifies HTTP %s',
    async (status, name) =>
      await expect(
        client(new Response(null, { status: Number(status) })).get(url, z.object({})),
      ).rejects.toMatchObject({ status: name }),
  );
  it('rejects non JSON content-type and invalid JSON', async () => {
    await expect(
      client(new Response('<html>', { headers: { 'Content-Type': 'text/html' } })).get(
        url,
        z.object({}),
      ),
    ).rejects.toMatchObject({ status: 'invalid-json' });
    await expect(
      client(new Response('{', { headers: { 'Content-Type': 'application/json' } })).get(
        url,
        z.object({}),
      ),
    ).rejects.toMatchObject({ status: 'invalid-json' });
  });
  it('rejects schema mismatch', async () =>
    await expect(
      client(new Response('{}', { headers: { 'Content-Type': 'application/json' } })).get(
        url,
        z.object({ f: z.literal('o') }),
      ),
    ).rejects.toMatchObject({ status: 'schema-incompatible' }));
  it('limits advertised and streamed response sizes', async () => {
    await expect(
      client(
        new Response('{}', {
          headers: { 'Content-Type': 'application/json', 'Content-Length': '99999' },
        }),
      ).get(url, z.object({})),
    ).rejects.toMatchObject({ status: 'invalid-json' });
    await expect(
      client(
        new Response(' '.repeat(1025), { headers: { 'Content-Type': 'application/json' } }),
      ).get(url, z.object({})),
    ).rejects.toMatchObject({ status: 'invalid-json' });
  });
  it('aborts requests on timeout', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        (_url, opts) =>
          new Promise((_, reject) =>
            opts.signal.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      );
    await expect(
      new TSEClient(new RequestGate(), fetcher, 5).get(url, z.object({})),
    ).rejects.toMatchObject({ status: 'timeout' });
  });
  it('bounds adaptive polling, 404 cooldown and global 429 ban', () => {
    expect(pollDelay('ok', 0, 0, () => 0)).toBe(2000);
    expect(pollDelay('ok', 100, 0, () => 0)).toBe(30_000);
    expect(pollDelay('unpublished', 0, 0, () => 0)).toBe(300_000);
    expect(pollDelay('rate-limited', 0, 0, () => 0)).toBe(600_000);
    expect(pollDelay('upstream-error', 0, 3, () => 0.5)).toBe(40_000);
    expect(retryAfter('600')).toBe(600_000);
  });
  it('caps request budget far below the TSE limit', () =>
    expect(() => new RequestGate(100)).toThrow());
});
describe('SSE', () => {
  const view: View = {
    resource: emptyResource(),
    events: [],
    health: null,
    releaseAt: '2026-10-04T17:00:00-03:00',
  };
  it('frames snapshots with replay id and named event', () => {
    const id = viewRevision(view);
    expect(sseFrame(view, id)).toContain(`id: ${id}\nevent: snapshot\ndata: `);
    expect(sseFrame(view, id).endsWith('\n\n')).toBe(true);
  });
  it('ignores heartbeat churn but not degradation', () => {
    expect(
      viewRevision({
        ...view,
        resource: { ...view.resource, lastCheckedAt: new Date().toISOString() },
      }),
    ).toBe(viewRevision(view));
    expect(
      viewRevision({ ...view, resource: { ...view.resource, status: 'invalid-signature' } }),
    ).not.toBe(viewRevision(view));
  });
});
