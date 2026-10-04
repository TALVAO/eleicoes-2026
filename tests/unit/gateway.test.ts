import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { handler, targetUrl } from '../../deploy/free-gateway/api/proxy.mjs';
const origin = 'https://validation.loca.lt';
const token = 'isolated-gateway-test-secret';
function signedResponse(
  body: string,
  options: RequestInit | undefined,
  extra: Record<string, string> = {},
) {
  const nonce = (options?.headers as Record<string, string>)['x-free-gateway-nonce'];
  return new Response(body, {
    headers: {
      ...extra,
      'x-free-gateway-origin': createHmac('sha256', token).update(nonce).digest('hex'),
    },
  });
}
function response() {
  return {
    code: 0,
    body: '',
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string | string[]) {
      this.headers[name] = Array.isArray(value) ? value.join('; ') : value;
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
    const proxy = handler(
      async (_url, options) => {
        forwarded = options;
        return signedResponse('official-response', options, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        });
      },
      origin,
      token,
    );
    await proxy({ ...request, headers: { rsc: '1' } }, res);
    expect(res.code).toBe(200);
    expect(res.body).toBe('official-response');
    expect(res.headers['cache-control']).toBe('no-store');
    expect((forwarded?.headers as Record<string, string>).rsc).toBe('1');
    expect(forwarded?.redirect).toBe('error');
    expect(res.headers['x-free-gateway-origin']).toBeUndefined();
  });
  it('shows a graceful API error without exposing the upstream exception', async () => {
    const res = response();
    await handler(
      async () => {
        throw new Error('private-technical-detail');
      },
      origin,
      token,
    )(request, res);
    expect(res.code).toBe(503);
    expect(res.body).not.toContain('private-technical-detail');
    expect(JSON.parse(res.body).message).toContain('Conexão temporariamente indisponível');
  });
  it('rejects oversized payloads and unsupported methods', async () => {
    const res = response();
    const proxy = handler(
      async (_url, options) => signedResponse('large', options, { 'content-length': '5000000' }),
      origin,
      token,
    );
    await proxy(request, res);
    expect(res.code).toBe(503);
    const other = response();
    await proxy({ ...request, method: 'POST' }, other);
    expect(other.code).toBe(405);
  });
  it('rejects a relay landing page returned with HTTP 200 and displays a friendly page', async () => {
    const res = response();
    await handler(
      async () => new Response('relay-landing-page'),
      origin,
      token,
    )({ ...request, query: { path: '' } }, res);
    expect(res.code).toBe(503);
    expect(res.body).toContain('Aguardando conexão');
    expect(res.body).not.toContain('relay-landing-page');
  });
  it('forwards only permitted chat writes, session cookies and pseudonymous client identity', async () => {
    let forwarded: RequestInit | undefined;
    const res = response();
    await handler(
      async (_url, options) => {
        forwarded = options;
        return signedResponse('joined', options, {
          'set-cookie': 'ele2026-chat=session; HttpOnly; SameSite=Strict',
        });
      },
      origin,
      token,
    )(
      {
        ...request,
        method: 'POST',
        query: { path: 'api/chat/session' },
        url: '/api/chat/session',
        body: { nickname: 'Visitante', state: 'ac', municipality: '01120' },
        headers: {
          'content-type': 'application/json',
          origin: 'https://public.example',
          cookie: 'ele2026-chat=previous',
          'x-forwarded-for': '192.0.2.7',
          'x-chat-client': 'spoofed',
        },
      },
      res,
    );
    expect(res.code).toBe(200);
    const headers = forwarded?.headers as Record<string, string>;
    expect(headers['x-chat-client']).toMatch(/^[a-f0-9]{64}$/);
    expect(headers['x-chat-client']).not.toContain('192.0.2.7');
    expect(headers.cookie).toBe('ele2026-chat=previous');
    expect(headers.origin).toBe('https://public.example');
    expect(JSON.parse(String(forwarded?.body)).nickname).toBe('Visitante');
    expect(res.headers['Set-Cookie']).toContain('HttpOnly');
  });
  it('rejects oversize chat writes and does not enable arbitrary write endpoints', async () => {
    const proxy = handler(async (_url, options) => signedResponse('ok', options), origin, token);
    const large = response();
    await proxy(
      {
        ...request,
        method: 'POST',
        query: { path: 'api/chat/messages' },
        headers: { 'content-type': 'application/json' },
        body: { text: 'x'.repeat(5000) },
      },
      large,
    );
    expect(large.code).toBe(413);
    const unrelated = response();
    await proxy({ ...request, method: 'POST', query: { path: 'api/results' } }, unrelated);
    expect(unrelated.code).toBe(405);
  });
});
