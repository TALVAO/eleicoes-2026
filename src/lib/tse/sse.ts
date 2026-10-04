import { createHash } from 'node:crypto';
import type { View } from './types';
export function viewRevision(view: View): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        view.resource.current?.source.hash,
        view.resource.status,
        view.health?.status,
        view.health?.sourceStatus,
        view.health?.heartbeatAt ? Date.now() - Date.parse(view.health.heartbeatAt) > 45_000 : true,
      ]),
    )
    .digest('hex');
}
export function sseFrame(view: View, id: string): string {
  return `id: ${id}\nevent: snapshot\ndata: ${JSON.stringify(view)}\n\n`;
}
