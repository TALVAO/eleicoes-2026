import { getStore } from '@/server/store';
import type { ExteriorSections } from '@/lib/tse/types';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return Response.json(await getStore().get<ExteriorSections>('exterior:sections'), {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch {
    return Response.json(null, { status: 503 });
  }
}
