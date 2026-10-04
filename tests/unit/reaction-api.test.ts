import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ea20Schema } from '../../src/lib/tse/schemas';
import { adaptResult } from '../../src/lib/tse/adapters/results';
const mocks = vi.hoisted(() => ({ view: vi.fn(), rate: vi.fn(), read: vi.fn(), change: vi.fn() }));
vi.mock('../../src/server/read-model', () => ({ readView: mocks.view }));
vi.mock('../../src/server/reactions', () => ({
  getReactionRepository: () => ({ read: mocks.read, change: mocks.change }),
}));
vi.mock('../../src/server/chat/repository', () => ({
  getChatRepository: () => ({ rate: mocks.rate }),
}));
const fixture = adaptResult(
  ea20Schema.parse(JSON.parse(readFileSync('docs/sources/EA20-BR.json', 'utf8'))),
  '6257:br:-:1',
  '1',
  'br',
  null,
);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  Object.values(mocks).forEach((m) => m.mockReset());
});
describe('Visitor reaction API authority and publication gates', () => {
  async function setup(released = true) {
    vi.stubEnv('SITE_URL', 'https://public.example');
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-04T21:00:00Z'));
    const result = { ...fixture, phase: released ? 'counting' : 'unreleased' };
    mocks.view.mockResolvedValue({
      resource: { current: { data: result } },
      releaseAt: '2026-10-04T20:00:00Z',
    });
    mocks.rate.mockResolvedValue(true);
    mocks.read.mockResolvedValue({});
    return import('../../src/app/api/chat/reactions/route');
  }
  const request = (body: unknown, origin = 'https://public.example') =>
    new Request('https://public.example/api/chat/reactions', {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  it('requires published official candidate and protects the anonymous choice cookie', async () => {
    const { POST } = await setup();
    const response = await POST(request({ candidate: fixture.candidates[0].id, value: 'like' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly; SameSite=Strict');
    expect(response.headers.get('Set-Cookie')).toContain('; Secure');
    expect(mocks.change).toHaveBeenCalledWith(
      fixture.election,
      fixture.candidates[0].id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      'like',
    );
    const unknown = await POST(request({ candidate: '999999999', value: 'like' }));
    expect(unknown.status).toBe(400);
    expect(mocks.change).toHaveBeenCalledTimes(1);
  });
  it('rejects preparation, cross-origin, client-supplied election and rate overflow', async () => {
    const { POST } = await setup(false);
    expect(
      (await POST(request({ candidate: fixture.candidates[0].id, value: 'like' }))).status,
    ).toBe(409);
    expect(
      (
        await POST(
          request({ candidate: fixture.candidates[0].id, value: 'like' }, 'https://evil.test'),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await POST(
          request({ candidate: fixture.candidates[0].id, value: 'like', election: 'fake' }),
        )
      ).status,
    ).toBe(400);
    mocks.rate.mockResolvedValue(false);
    expect(
      (await POST(request({ candidate: fixture.candidates[0].id, value: 'like' }))).status,
    ).toBe(429);
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it('does not return zero counters when Redis is unavailable', async () => {
    const { GET } = await setup();
    mocks.read.mockRejectedValue(new Error('private-secret'));
    const response = await GET(new Request('https://public.example/api/chat/reactions'));
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).not.toContain('private-secret');
    expect(body).not.toContain('counts');
  });
});
