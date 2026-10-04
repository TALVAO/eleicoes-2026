import { readCatalog } from '@/server/read-model';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(await readCatalog(), {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
    });
  } catch {
    return Response.json(null, { status: 503 });
  }
}
