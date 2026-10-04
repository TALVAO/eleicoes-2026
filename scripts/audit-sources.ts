import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  ea11Schema,
  ea12Schema,
  ea20Schema,
  ea16Schema,
  trackingSchema,
} from '../src/lib/tse/schemas';
import { verifyOfficialJws } from '../src/lib/tse/validation';
const base = 'https://resultados.tse.jus.br/oficial/ele2026/';
const files: Record<string, string> = {
  'ele-c.json': 'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json',
  'EA12.json': base + '6257/config/mun-e006257-cm.json',
  'EA14.json': base + '6257/dados/br/br-e006257-ab.json',
  'EA14-JWS.jws': base + '6257/dados/br/br-e006257-ab.jws',
  'EA15-ZZ.json': base + '6257/dados/zz/zz-e006257-ab.json',
  'EA20-BR.json': base + '6257/dados/br/br-c0001-e006257-u.json',
  'EA20-BR-JWS.jws': base + '6257/dados/br/br-c0001-e006257-u.jws',
  'EA20-ZZ.json': base + '6257/dados/zz/zz-c0001-e006257-u.json',
  'EA20-ZZ-JWS.jws': base + '6257/dados/zz/zz-c0001-e006257-u.jws',
  'EA20-LOCAL.json': base + '6257/dados/zz/zz29254-c0001-e006257-u.json',
  'EA16-ZZ.json': base + 'arquivo-urna/3220/config/zz/zz-p003220-cs.json',
};
const inventory = [];
for (const [file, url] of Object.entries(files)) {
  const path = join('docs/sources', file),
    bytes = await readFile(path);
  const json = JSON.parse(
    file.endsWith('.jws')
      ? await verifyOfficialJws(bytes.toString('utf8'))
      : bytes.toString('utf8'),
  );
  const schema = file.startsWith('ele-c')
    ? ea11Schema
    : file.startsWith('EA12')
      ? ea12Schema
      : file.startsWith('EA16')
        ? ea16Schema
        : file.startsWith('EA20')
          ? ea20Schema
          : trackingSchema;
  schema.parse(json);
  inventory.push({
    file,
    url,
    capturedFileModifiedAt: (await stat(path)).mtime.toISOString(),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    generatedAt: json.dg + ' ' + json.hg,
    validation: file.endsWith('.jws') ? 'signature-verified' : 'schema-verified',
  });
}
async function allFiles(dir: string): Promise<string[]> {
  const found = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      found.map((e) =>
        e.isDirectory() ? allFiles(join(dir, e.name)) : Promise.resolve([join(dir, e.name)]),
      ),
    )
  ).flat();
}
const sources = await allFiles('src');
for (const path of sources) {
  const code = await readFile(path, 'utf8');
  if (
    /(?:from\s+|import\s*\()['"][^'"]*(?:docs\/sources|fixtures|seed-e2e|mocks|\/tests\/)/.test(
      code,
    )
  )
    throw new Error('Test-data import in production: ' + path);
  if (/(?:Google|Associated Press|api\.ap\.org|newsapi\.org)/i.test(code))
    throw new Error('Unapproved provider in production: ' + path);
  if (path.includes('components') && /\b\d[\d.,]*\s+votos\b/.test(code))
    throw new Error('Literal electoral count in UI: ' + path);
}
await writeFile(
  'docs/sources/inventory.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      notice: 'Captured official fixtures for tests/documentation. Never read by production.',
      files: inventory,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    {
      status: 'passed',
      officialCaptures: inventory.length,
      productionSourceFiles: sources.length,
      jwsVerified: inventory.filter((x) => x.validation === 'signature-verified').length,
      limitations:
        'Static audit; does not prove every future code path. Review whitelist and worker traffic.',
    },
    null,
    2,
  ),
);
