import type { SourceStatus } from './types';
export function pollDelay(
  status: SourceStatus,
  unchanged: number,
  failures: number,
  random = Math.random,
): number {
  if (status === 'rate-limited') return 600_000 + Math.floor(random() * 30_000);
  if (status === 'unpublished') return 300_000 + Math.floor(random() * 30_000);
  if (status !== 'ok')
    return Math.min(300_000, 5000 * 2 ** Math.min(failures, 6)) * (0.8 + random() * 0.4);
  return Math.min(30_000, 2000 * 1.5 ** Math.min(unchanged, 7));
}
