import { getStore } from '@/server/store';
import type { WorkerHealth } from '@/lib/tse/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const health = await getStore().get<WorkerHealth>('health');
    const alive = health?.heartbeatAt && Date.now() - Date.parse(health.heartbeatAt) < 45_000;
    return Response.json(
      {
        ...health,
        status: alive ? health!.status : 'degraded',
        pollingStatus: alive ? health!.pollingStatus : 'stopped',
        lastSuccessfulFetch: health?.lastSuccessfulFetch ?? null,
        lastTSEUpdate: health?.lastTSEUpdate ?? null,
        lastSnapshotHash: health?.lastSnapshotHash ?? null,
        sourceStatus: health?.sourceStatus ?? 'configuration-unavailable',
      },
      {
        status: alive && health?.status === 'healthy' ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    return Response.json(
      {
        status: 'degraded',
        lastSuccessfulFetch: null,
        lastTSEUpdate: null,
        lastSnapshotHash: null,
        sourceStatus: 'configuration-unavailable',
        pollingStatus: 'stopped',
      },
      { status: 503 },
    );
  }
}
