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

export function handler(fetcher = fetch, origin = process.env.GATEWAY_ORIGIN) {
  return async function proxy(request, response) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      return response.status(405).end();
    }
    try {
      const path = Array.isArray(request.query.path) ? request.query.path[0] : request.query.path;
      const url = targetUrl(origin, request.url, path);
      const headers = { Accept: request.headers.accept ?? '*/*', 'bypass-tunnel-reminder': 'true' };
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
      });
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
      ]) {
        const value = upstream.headers.get(name);
        if (value) response.setHeader(name, value);
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
