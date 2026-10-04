import type { EA11, EA12 } from '../schemas';
import type { Catalog, Provenance } from '../types';
import { TSEExteriorAdapter } from './exterior';
export function electionConfig(config: EA11, date: string, turn: string) {
  const pl = config.pl.find((p) => p.dt === date && p.e.some((e) => e.t === turn && e.tp === '8'));
  if (!pl) throw new Error('Official election not available');
  const federal = pl.e.find(
    (e) => e.t === turn && e.tp === '8' && e.abr.some((a) => a.cp.some((c) => c.cd === '1')),
  );
  if (!federal) throw new Error('Presidential election not configured');
  return { pl, federal };
}
export function adaptCatalog(
  config: EA11,
  municipalities: EA12,
  source: Provenance,
  date: string,
  turn: string,
): Catalog {
  const { pl, federal } = electionConfig(config, date, turn);
  const exteriorCode = new TSEExteriorAdapter(municipalities).code;
  const exterior = municipalities.abr.find((a) => a.cd === exteriorCode);
  if (exterior && !federal.abr.some((a) => a.cd === 'br' || a.cd === exterior.cd))
    throw new Error('Exterior is not covered by the configured presidential election');
  const regions = municipalities.abr.map((a) => ({
    code: a.cd,
    name: a.ds,
    exterior: a === exterior,
    municipalities: a.mu.map((m) => ({ code: m.cd, name: m.nm, zones: m.z })),
  }));
  const offices = pl.e
    .filter((e) => e.t === turn)
    .flatMap((e) =>
      e.abr.flatMap((a) =>
        a.cp.map((c) => ({
          code: c.cd,
          name: c.ds,
          election: e.cd,
          regions:
            a.cd === 'br'
              ? regions.filter((r) => e.tp === '8' || !r.exterior).map((r) => r.code)
              : [a.cd],
        })),
      ),
    );
  return {
    date,
    turn,
    pleito: pl.cd,
    cycle: pl.c,
    federalElection: federal.cd,
    regions,
    offices: offices.filter(
      (o, i, a) => a.findIndex((x) => x.code === o.code && x.election === o.election) === i,
    ),
    exteriorCode: exterior?.cd ?? null,
    source,
  };
}
