import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';
import { proxy } from '../../src/proxy';
const previous = process.env.FREE_GATEWAY_TOKEN;
afterEach(() => {
  if (previous === undefined) delete process.env.FREE_GATEWAY_TOKEN;
  else process.env.FREE_GATEWAY_TOKEN = previous;
});
describe('Configured free origin authentication', () => {
  it('keeps normal hosting available without free gateway configuration', () => {
    delete process.env.FREE_GATEWAY_TOKEN;
    expect(proxy(new NextRequest('http://localhost/')).headers.get('x-middleware-next')).toBe('1');
  });
  it('rejects missing credentials without returning election data', async () => {
    process.env.FREE_GATEWAY_TOKEN = 'isolated-test-secret';
    const response = proxy(new NextRequest('http://localhost/api/results'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: 'Acesse pelo endereço público do site.' });
  });
  it('proves identity for a fresh nonce without exposing the shared secret', () => {
    const secret = (process.env.FREE_GATEWAY_TOKEN = 'isolated-test-secret');
    const nonce = 'a4c2de74-234d-4cc1-8eb2-835d24dcefc0';
    const response = proxy(
      new NextRequest('http://localhost/api/results', {
        headers: { 'x-free-gateway-token': secret, 'x-free-gateway-nonce': nonce },
      }),
    );
    expect(response.headers.get('x-free-gateway-origin')).toBe(
      createHmac('sha256', secret).update(nonce).digest('hex'),
    );
    expect(response.headers.get('x-free-gateway-token')).toBeNull();
  });
});
