import { NextResponse } from 'next/server';
import { readCatalog } from '@/server/read-model';
import { getStore } from '@/server/store';
import type { Resource, Result } from '@/lib/tse/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const catalog = await readCatalog();
    if (!catalog)
      return NextResponse.json({ status: 'configuration-unavailable' }, { status: 503 });
    const entries = await Promise.all(
      catalog.regions
        .filter((r) => !r.exterior)
        .map(async (r) => [
          r.code,
          await getStore().get<Resource<Result>>(`result:${catalog.federalElection}:${r.code}:-:1`),
        ]),
    );
    return NextResponse.json(Object.fromEntries(entries), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ status: 'temporarily-unavailable' }, { status: 503 });
  }
}
