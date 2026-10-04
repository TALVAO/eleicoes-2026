// One-off official-source verification; never writes production cache or community interactions.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { TSEClient, RequestGate } from '../src/lib/tse/client';
import { ea20Schema } from '../src/lib/tse/schemas';
import { adaptResult } from '../src/lib/tse/adapters/results';
import type { View } from '../src/lib/tse/types';
const publicUrl = 'https://eleicoes-2026-plum.vercel.app';
const response = await fetch(publicUrl + '/api/results?scope=br&office=1', {
  signal: AbortSignal.timeout(12000),
});
assert.equal(response.status, 200);
const view = (await response.json()) as View;
const snapshot = view.resource.current;
assert(snapshot && snapshot.source.validation === 'signature-verified');
const raw = await new TSEClient(new RequestGate(1)).get(snapshot.source.url, ea20Schema);
assert(!raw.unchanged);
if (raw.source.hash !== snapshot.source.hash)
  throw new Error('Official file changed since cached public snapshot; recheck after ingestion.');
const official = adaptResult(
  raw.data,
  snapshot.data.key,
  snapshot.data.office,
  snapshot.data.scope,
  snapshot.data.municipality,
);
assert.deepEqual(official.metrics, snapshot.data.metrics);
assert.equal(official.phase, snapshot.data.phase);
assert.equal(official.election, snapshot.data.election);
assert.equal(official.mathematicallyDefined, snapshot.data.mathematicallyDefined);
assert.deepEqual(
  official.candidates.map((c) => ({ ...c, photo: null })),
  snapshot.data.candidates.map((c) => ({ ...c, photo: null })),
);
const report = {
  checkedAt: new Date().toISOString(),
  status: 'passed',
  publicUrl,
  officialSource: snapshot.source.url,
  hash: raw.source.hash,
  signature: raw.source.validation,
  election: official.election,
  phase: official.phase,
  checked: [
    'all candidate identities, parties, votes, exact percentages, order and official status',
    'all metrics',
    'phase',
    'mathematical definition',
  ],
  notice:
    'Preparation data is official but hidden by UI until TSE release. No test counts or reactions written.',
};
mkdirSync('.impeccable/review', { recursive: true });
writeFileSync(
  '.impeccable/review/public-official-compare.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
