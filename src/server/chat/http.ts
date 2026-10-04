import { createHmac, timingSafeEqual } from 'node:crypto';
import { ChatError } from './service';
export const CHAT_COOKIE = 'ele2026-chat';
export const chatHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
export function chatCookie(request: Request) {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .find((s) => s.trim().startsWith(CHAT_COOKIE + '='))
    ?.trim()
    .slice(CHAT_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function clientKey(request: Request) {
  const secret = process.env.FREE_GATEWAY_TOKEN;
  const signedClient = request.headers.get('x-chat-client');
  if (secret && signedClient && /^[a-f0-9]{64}$/.test(signedClient)) return signedClient;
  // No untrusted client-supplied IP headers. Direct/local deployments share a stricter bucket.
  return createHmac('sha256', process.env.CHAT_ADMIN_TOKEN ?? 'local-development')
    .update('direct-client')
    .digest('hex');
}
export function requireOrigin(request: Request) {
  const expected = new URL(process.env.SITE_URL ?? 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== expected)
    throw new ChatError(403, 'Abra o chat pelo endereço do site.');
}
export function requireAdmin(request: Request) {
  const secret = process.env.CHAT_ADMIN_TOKEN ?? '';
  const a = Buffer.from(secret),
    b = Buffer.from(request.headers.get('x-chat-admin') ?? '');
  if (a.length < 32 || a.length !== b.length || !timingSafeEqual(a, b))
    throw new ChatError(403, 'Acesso à moderação não autorizado.');
}
export async function readChatBody(request: Request) {
  requireOrigin(request);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? ''))
    throw new ChatError(415, 'Formato de mensagem inválido.');
  if (Number(request.headers.get('content-length')) > 4096)
    throw new ChatError(413, 'Mensagem muito longa.');
  const reader = request.body?.getReader();
  if (!reader) throw new ChatError(400, 'Preencha os campos antes de continuar.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new ChatError(413, 'Mensagem muito longa.');
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof ChatError) throw error;
    throw new ChatError(400, 'Não foi possível ler a mensagem. Tente novamente.');
  } finally {
    reader.releaseLock();
  }
}
export function chatFailure(error: unknown) {
  if (error instanceof ChatError)
    return Response.json(
      { message: error.message },
      {
        status: error.status,
        headers: { ...chatHeaders, ...(error.status === 429 ? { 'Retry-After': '60' } : {}) },
      },
    );
  console.error(JSON.stringify({ event: 'chat_unavailable', at: new Date().toISOString() }));
  return Response.json(
    { message: 'A conversa está temporariamente indisponível. Tente novamente em instantes.' },
    { status: 503, headers: chatHeaders },
  );
}
export function sessionCookie(token: string, remove = false) {
  const secure = (process.env.SITE_URL ?? '').startsWith('https:') ? '; Secure' : '';
  return `${CHAT_COOKIE}=${token}; Path=/api/chat; HttpOnly; SameSite=Strict; Max-Age=${remove ? 0 : 86400}${secure}`;
}
