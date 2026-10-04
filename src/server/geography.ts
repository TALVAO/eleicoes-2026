import type { Catalog, Resource, Result } from '@/lib/tse/types';
import { geographicArea, type GeographyView } from '@/features/president/model';
import { getStore } from './store';
import { readCatalog } from './read-model';
export async function readGeography(): Promise<GeographyView> {
  const catalog: Catalog | null = await readCatalog();
  if (!catalog) throw new Error('Official catalog unavailable');
  const store = getStore();
  const regions = catalog.regions.filter((r) => !r.exterior);
  const releaseAt = `${catalog.date.split('/').reverse().join('-')}T17:00:00-03:00`;
  const now = Date.now();
  const states = (
    await Promise.all(
      regions.map(async (r) =>
        geographicArea(
          await store.get<Resource<Result>>(`result:${catalog.federalElection}:${r.code}:-:1`),
          r.name,
          releaseAt,
          now,
        ),
      ),
    )
  ).filter((a) => a !== null);
  const observed = ((await store.get<string[]>('municipalities:observed')) ?? []).slice(-300);
  const municipalities = (
    await Promise.all(
      observed.map(async (key) => {
        const [election, scope, municipality, office] = key.split(':');
        const region = regions.find((r) => r.code === scope);
        const locality = region?.municipalities.find((m) => m.code === municipality);
        if (!locality || election !== catalog.federalElection || office !== '1') return null;
        return geographicArea(
          await store.get<Resource<Result>>('result:' + key),
          `${locality.name} · ${scope.toUpperCase()}`,
          releaseAt,
          now,
        );
      }),
    )
  ).filter((a) => a !== null);
  return {
    states,
    municipalities,
    expectedStates: regions.length,
    observedMunicipalities: municipalities.length,
    totalMunicipalities: regions.reduce((sum, r) => sum + r.municipalities.length, 0),
  };
}
