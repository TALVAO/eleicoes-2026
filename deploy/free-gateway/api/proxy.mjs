const LIMIT = 4 * 1024 * 1024;
const MESSAGE =
  'Conexão temporariamente indisponível. O servidor de apuração precisa estar ligado e conectado. Tente novamente em alguns instantes.';
const ERROR_PAGE = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Eleições 2026 — Conexão indisponível</title><style>body{font:18px system-ui;background:#f7f8fa;color:#182534;margin:0;padding:10vh 24px}main{max-width:600px;margin:auto}small{letter-spacing:.15em}h1{font-size:36px}p{line-height:1.6}a{color:#235a9d}</style><main><small>ELEIÇÕES 2026</small><h1>Aguardando conexão</h1><p>${MESSAGE}</p><p><a href="/">Tentar novamente</a></p><p><a href="https://resultados.tse.jus.br">Consultar a fonte oficial do TSE</a></p></main></html>`;

export function targetUrl(origin, requestUrl, path) {
  const target = new URL(origin);
  if (
    target.protocol !== 'https:' ||
    !target.hostname.endsWith('.loca.lt') ||
    target.username ||
    target.password ||
    target.port
  )
    throw new Error('Invalid configured origin');
  target.pathname = '/' + String(path ?? '').replace(/^\/+/, '');
  target.search = new URL(requestUrl, 'https://gateway.invalid').search;
  target.searchParams.delete('path');
  target.hash = '';
  return target;
}

export function handler(
  fetcher = fetch,
  origin = process.env.GATEWAY_ORIGIN,
  token = process.env.GATEWAY_TOKEN,
) {
  return async function proxy(request, response) {
    const path = Array.isArray(request.query.path) ? request.query.path[0] : request.query.path;
    const chat = /^api\/chat\/(session|messages|reports|moderation|reactions)$/.test(String(path));
    if (!['GET', 'HEAD'].includes(request.method) && !(request.method === 'POST' && chat)) {
      response.setHeader('Allow', 'GET, HEAD');
      return response.status(405).end();
    }
    try {
      if (!token) throw new Error('Origin authentication required');
      const url = targetUrl(origin, request.url, path);
      const nonce = randomUUID();
      const headers = {
        Accept: request.headers.accept ?? '*/*',
        'bypass-tunnel-reminder': 'true',
        'x-free-gateway-token': token,
        'x-free-gateway-nonce': nonce,
      };
      if (request.headers['if-none-match']) headers['if-none-match'] = request.headers['if-none-match'];
      let body;
      if (chat) {
        // Vercel overwrites X-Forwarded-For; never forward the visitor's custom identity header.
        const ip = String(
          request.headers['x-forwarded-for'] ?? request.socket?.remoteAddress ?? 'unknown',
        )
          .split(',')[0]
          .trim();
        headers['x-chat-client'] = createHmac('sha256', token).update(ip).digest('hex');
        for (const name of ['cookie', 'origin', 'if-none-match'])
          if (request.headers[name]) headers[name] = request.headers[name];
        if (path === 'api/chat/moderation' && request.headers['x-chat-admin'])
          headers['x-chat-admin'] = request.headers['x-chat-admin'];
        if (request.method === 'POST') {
          if (!/^application\/json(?:;|$)/i.test(String(request.headers['content-type'] ?? ''))) {
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Cache-Control', 'no-store');
            return response
              .status(415)
              .end(JSON.stringify({ message: 'Formato de mensagem inválido.' }));
          }
          body =
            typeof request.body === 'string' || Buffer.isBuffer(request.body)
              ? request.body
              : JSON.stringify(request.body ?? null);
          if (Buffer.byteLength(body) > 4096) {
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Cache-Control', 'no-store');
            return response.status(413).end(JSON.stringify({ message: 'Mensagem muito longa.' }));
          }
          headers['content-type'] = 'application/json';
        }
      }
      for (const name of [
        'rsc',
        'next-router-state-tree',
        'next-router-prefetch',
        'next-router-segment-prefetch',
        'next-url',
      ]) {
        if (request.headers[name]) headers[name] = request.headers[name];
      }
      const upstream = await fetcher(url, {
        method: request.method,
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
        headers,
        ...(body !== undefined ? { body } : {}),
      });
      const supplied = Buffer.from(upstream.headers.get('x-free-gateway-origin') ?? '');
      const expected = Buffer.from(createHmac('sha256', token).update(nonce).digest('hex'));
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
        throw new Error('Origin identity mismatch');
      if (Number(upstream.headers.get('content-length')) > LIMIT) throw new Error('Oversize');
      const reader = upstream.body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader)
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > LIMIT) {
            await reader.cancel();
            throw new Error('Oversize');
          }
          chunks.push(Buffer.from(value));
        }
      for (const name of [
        'content-type',
        'cache-control',
        'etag',
        'last-modified',
        'content-security-policy',
        'x-content-type-options',
        'referrer-policy',
        'x-frame-options',
        'permissions-policy',
        'service-worker-allowed',
        'vary',
        'retry-after',
      ]) {
        const value = upstream.headers.get(name);
        if (value) response.setHeader(name, value);
      }
      if (chat) {
        const cookies = upstream.headers.getSetCookie();
        if (cookies.length) response.setHeader('Set-Cookie', cookies);
      }
      return response.status(upstream.status).end(Buffer.concat(chunks));
    } catch {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      if (String(request.query.path ?? '').startsWith('api/')) {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        return response.status(503).end(JSON.stringify({ message: MESSAGE }));
      }
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      return response.status(503).end(ERROR_PAGE);
    }
  };
}
export default handler();
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
