import { describe, expect, it } from 'vitest';
import { handler, targetUrl } from '../../deploy/free-gateway/api/proxy.mjs';
const origin = 'https://validation.loca.lt';
function response() {
  return {
    code: 0,
    body: '',
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.code = code;
      return this;
    },
    end(body?: Buffer | string) {
      this.body = String(body ?? '');
      return this;
    },
  };
}
const request = {
  method: 'GET',
  url: '/?scope=br&path=api/results',
  query: { path: 'api/results' },
  headers: {} as Record<string, string>,
};
describe('Free gateway controlled HTTPS forwarding', () => {
  it('keeps supplied paths on the configured origin and preserves valid query parameters', () => {
    const target = targetUrl(origin, request.url, '//other-host.invalid/api/results');
    expect(target.origin).toBe(origin);
    expect(target.search).toBe('?scope=br');
    expect(() => targetUrl('https://resultados.tse.jus.br', '/', '')).toThrow();
    expect(() => targetUrl('http://validation.loca.lt', '/', '')).toThrow();
    expect(() => targetUrl('https://user:secret@validation.loca.lt', '/', '')).toThrow();
  });
  it('preserves official response content, cache headers and Next navigation headers', async () => {
    const res = response();
    let forwarded: RequestInit | undefined;
    const proxy = handler(async (_url, options) => {
      forwarded = options;
      return new Response('official-response', {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }, origin);
    await proxy({ ...request, headers: { rsc: '1' } }, res);
    expect(res.code).toBe(200);
    expect(res.body).toBe('official-response');
    expect(res.headers['cache-control']).toBe('no-store');
    expect((forwarded?.headers as Record<string, string>).rsc).toBe('1');
    expect(forwarded?.redirect).toBe('error');
  });
  it('shows a graceful API error without exposing the upstream exception', async () => {
    const res = response();
    await handler(async () => {
      throw new Error('private-technical-detail');
    }, origin)(request, res);
    expect(res.code).toBe(503);
    expect(res.body).not.toContain('private-technical-detail');
    expect(JSON.parse(res.body).message).toContain('Conexão temporariamente indisponível');
  });
  it('rejects oversized payloads and unsupported methods', async () => {
    const res = response();
    const proxy = handler(
      async () => new Response('large', { headers: { 'content-length': '5000000' } }),
      origin,
    );
    await proxy(request, res);
    expect(res.code).toBe(503);
    const other = response();
    await proxy({ ...request, method: 'POST' }, other);
    expect(other.code).toBe(405);
  });
});
