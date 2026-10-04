import { getStore } from '@/server/store';
import { readCatalog } from '@/server/read-model';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams,
    id = p.get('id'),
    election = p.get('election');
  if (!id || !election || !/^\d{1,16}$/.test(id) || !/^\d{1,6}$/.test(election))
    return new Response(null, { status: 400 });
  try {
    const catalog = await readCatalog();
    if (!catalog?.offices.some((o) => o.election === election))
      return new Response(null, { status: 404 });
    const data = await getStore().get<string>(`photo:${election}:${id}`);
    if (!data) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(Buffer.from(data, 'base64'), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
