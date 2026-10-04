import type { Catalog } from '@/lib/tse/types';
export interface Query {
  scope: string;
  office: string;
  municipality: string | null;
  key: string;
  election: string;
}
export function resolveQuery(catalog: Catalog, params: URLSearchParams): Query | null {
  const scope = params.get('scope') ?? 'br',
    office = params.get('office') ?? '1',
    municipality = params.get('municipality');
  if (
    !/^[a-z]{2}$/.test(scope) ||
    !/^\d{1,4}$/.test(office) ||
    (municipality && !/^\d{5}$/.test(municipality))
  )
    return null;
  const region = catalog.regions.find((r) => r.code === scope);
  if (scope !== 'br' && !region) return null;
  const cargo = catalog.offices.find(
    (o) => o.code === office && (scope === 'br' ? office === '1' : o.regions.includes(scope)),
  );
  if (!cargo) return null;
  if ((office === '7' && scope === 'df') || (office === '8' && scope !== 'df')) return null;
  if (municipality && !region?.municipalities.some((m) => m.code === municipality)) return null;
  return {
    scope,
    office,
    municipality,
    key: [cargo.election, scope, municipality ?? '-', office].join(':'),
    election: cargo.election,
  };
}
