// Bounded localhost-only smoke load. Never runs against TSE, tunnel or public deployment.
import { writeFileSync, mkdirSync } from 'node:fs';
const target = new URL(process.argv[2] ?? 'http://127.0.0.1:3100');
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '3100')
  throw new Error('Only isolated localhost:3100 allowed');
const total = 1000,
  concurrency = 25;
const latencies = [];
let next = 0,
  failures = 0;
const start = performance.now();
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < total) {
      const index = next++;
      const begin = performance.now();
      try {
        const response = await fetch(
          new URL(index % 2 ? '/api/results?scope=br&office=1' : '/api/geography', target),
          { signal: AbortSignal.timeout(8000) },
        );
        if (!response.ok) throw new Error('Non-200');
        const body = await response.json();
        if (index % 2 ? !body.resource : !Array.isArray(body.states))
          throw new Error('Invalid response');
      } catch {
        failures++;
      }
      latencies.push(performance.now() - begin);
    }
  }),
);
latencies.sort((a, b) => a - b);
const report = {
  capturedAt: new Date().toISOString(),
  environment:
    'isolated localhost / captured official preparation cache / no worker / no TSE traffic',
  requests: total,
  concurrency,
  failures,
  durationMs: Math.round(performance.now() - start),
  p50Ms: Math.round(latencies[Math.floor(total * 0.5)]),
  p95Ms: Math.round(latencies[Math.floor(total * 0.95)]),
  p99Ms: Math.round(latencies[Math.floor(total * 0.99)]),
  caveat:
    'Local API smoke load only; not unique visitors, not Vercel/tunnel bandwidth or nationwide capacity.',
};
mkdirSync('.impeccable/review', { recursive: true });
writeFileSync('.impeccable/review/load-local.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (failures) process.exitCode = 1;
