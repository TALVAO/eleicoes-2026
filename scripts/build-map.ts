// Build-time geometry only. Electoral names, candidates and values come from TSE at runtime.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
const point = z.tuple([z.number(), z.number()]);
const ring = z.array(point);
const geometry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(ring) }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(ring)) }),
]);
const bytes = readFileSync('docs/sources/geography/br-uf.geojson');
const collection = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z.object({
        properties: z.object({ codarea: z.string() }),
        geometry,
      }),
    ),
  })
  .parse(JSON.parse(bytes.toString()));
const states = z
  .array(z.object({ id: z.number(), sigla: z.string().length(2) }))
  .parse(JSON.parse(readFileSync('docs/sources/geography/states.json', 'utf8')));
// Equirectangular projection centred on Brazil, with fixed longitudinal correction.
const project = ([lon, lat]: [number, number]) => [(lon + 74) * 11.7, (6 - lat) * 11.7];
const shapes = collection.features.map((f) => {
  const state = states.find((s) => String(s.id) === f.properties.codarea);
  if (!state) throw new Error('Unknown IBGE state');
  const rings =
    f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
  const d = rings
    .map(
      (r) =>
        r
          .map(
            (p, i) =>
              `${i ? 'L' : 'M'}${project(p)
                .map((n) => n.toFixed(1))
                .join(',')}`,
          )
          .join('') + 'Z',
    )
    .join('');
  return { uf: state.sigla.toLowerCase(), d };
});
if (new Set(shapes.map((s) => s.uf)).size !== 27) throw new Error('Incomplete state geometry');
mkdirSync('src/features/president', { recursive: true });
writeFileSync('src/features/president/map-shapes.json', JSON.stringify(shapes));
writeFileSync(
  'docs/sources/geography/provenance.json',
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      geometry:
        'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&formato=application/vnd.geo%2Bjson&qualidade=minima',
      mapping: 'https://servicodados.ibge.gov.br/api/v1/localidades/estados',
      documentation: 'https://servicodados.ibge.gov.br/api/docs/malhas?versao=3',
      notice:
        'Static geographic boundaries only. No IBGE electoral data. All electoral values are TSE.',
    },
    null,
    2,
  ) + '\n',
);
console.log('27 official state paths generated.');
