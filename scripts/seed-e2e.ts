// Captured official preparation files. This cache is exclusively for E2E.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ea11Schema, ea12Schema, ea20Schema, ea16Schema } from '../src/lib/tse/schemas';
import { adaptCatalog } from '../src/lib/tse/adapters/elections';
import { adaptResult } from '../src/lib/tse/adapters/results';
import { TSEExteriorAdapter } from '../src/lib/tse/adapters/exterior';
import { verifyOfficialJws, officialTimestamp } from '../src/lib/tse/validation';
import { createStore } from '../src/server/store';
import { commitSnapshot, emptyResource } from '../src/lib/tse/cache';
import type { Provenance } from '../src/lib/tse/types';
process.env.CACHE_DIR = '.data-e2e';
delete process.env.REDIS_URL;
const store = createStore();
const load = (name: string) => JSON.parse(readFileSync('docs/sources/' + name + '.json', 'utf8'));
const source: Provenance = {
  url: 'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json',
  generatedAt: null,
  fetchedAt: new Date().toISOString(),
  etag: null,
  lastModified: null,
  hash: '',
  validation: 'schema-verified',
};
const conf = ea11Schema.parse(load('ele-c')),
  mu = ea12Schema.parse(load('EA12'));
const catalog = adaptCatalog(conf, mu, source, '04/10/2026', '1');
await store.put('catalog', catalog);
for (const [name, scope] of [
  ['EA20-BR-JWS', 'br'],
  ['EA20-ZZ-JWS', 'zz'],
]) {
  const payload = await verifyOfficialJws(readFileSync('docs/sources/' + name + '.jws', 'utf8')),
    raw = ea20Schema.parse(JSON.parse(payload));
  const key = `6257:${scope}:-:1`,
    data = adaptResult(raw, key, '1', scope, null);
  const provenance = {
    ...source,
    url: `https://resultados.tse.jus.br/oficial/ele2026/6257/dados/${scope}/${scope}-c0001-e006257-u.jws`,
    generatedAt: officialTimestamp(raw.dg, raw.hg),
    hash: createHash('sha256').update(payload).digest('hex'),
    validation: 'signature-verified' as const,
  };
  await store.put(
    'result:' + key,
    commitSnapshot(emptyResource(), { data, source: provenance }).resource,
  );
}
await store.put(
  'exterior:sections',
  new TSEExteriorAdapter(mu).sections(ea16Schema.parse(load('EA16-ZZ')), source),
);
await store.put('health', {
  status: 'healthy',
  heartbeatAt: new Date().toISOString(),
  lastSuccessfulFetch: new Date().toISOString(),
  lastTSEUpdate: source.generatedAt,
  lastSnapshotHash: source.hash,
  sourceStatus: 'ok',
  pollingStatus: 'running',
  nextPollAt: null,
});
await store.close();
console.log('Official preparation fixtures seeded in .data-e2e only.');
