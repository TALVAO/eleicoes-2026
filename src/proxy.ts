import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const secret = process.env.FREE_GATEWAY_TOKEN;
  if (!secret) return NextResponse.next();
  const supplied = request.headers.get('x-free-gateway-token') ?? '';
  const nonce = request.headers.get('x-free-gateway-nonce') ?? '';
  const a = Buffer.from(secret),
    b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b) || !/^[a-f0-9-]{36}$/.test(nonce)) {
    return NextResponse.json(
      { message: 'Acesse pelo endereço público do site.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.next({
    headers: { 'x-free-gateway-origin': createHmac('sha256', secret).update(nonce).digest('hex') },
  });
}
export const config = { matcher: '/:path*' };
