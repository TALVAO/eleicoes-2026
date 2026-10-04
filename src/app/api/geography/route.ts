import { createHash } from 'node:crypto';
import { readGeography } from '@/server/geography';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type CacheEntry = { expires: number; body: string; etag: string };
let cached: CacheEntry | null = null;
let pending: Promise<CacheEntry> | null = null;
export async function GET(request: Request) {
  try {
    if (!cached || cached.expires <= Date.now()) {
      pending ??= readGeography()
        .then((data) => {
          const body = JSON.stringify(data);
          return (cached = {
            body,
            etag: '"' + createHash('sha256').update(body).digest('hex') + '"',
            expires: Date.now() + 2000,
          });
        })
        .finally(() => {
          pending = null;
        });
      cached = await pending;
    }
    const headers = {
      'Content-Type': 'application/json',
      ETag: cached.etag,
      'Cache-Control': 'public, max-age=0, s-maxage=2, must-revalidate',
    };
    return new Response(request.headers.get('if-none-match') === cached.etag ? null : cached.body, {
      status: request.headers.get('if-none-match') === cached.etag ? 304 : 200,
      headers,
    });
  } catch {
    return Response.json(
      { message: 'Não foi possível atualizar o mapa agora.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
