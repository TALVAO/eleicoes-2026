import { readCatalog, readView } from '@/server/read-model';
import { ResultsLive } from './results-live';
import { Navigation } from './navigation';
import { Explorer, OfficeSelector, StatesList } from './explorer';
import { Comparison } from './comparison';
import { getStore } from '@/server/store';
import { emptyResource } from '@/lib/tse/cache';
import type { Resource, Result, View, ExteriorSections } from '@/lib/tse/types';
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const fallback: View = {
  resource: { ...emptyResource(), status: 'configuration-unavailable' },
  events: [],
  health: null,
  releaseAt: '2026-10-04T17:00:00-03:00',
};
export async function ElectionPage({
  tab,
  searchParams,
}: {
  tab: 'brasil' | 'estados' | 'municipios' | 'exterior';
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  let catalog = null;
  try {
    catalog = await readCatalog();
  } catch {}
  if (tab === 'exterior' && !catalog?.exteriorCode)
    return (
      <>
        <Navigation active="exterior" />
        <main id="main" className="container">
          <div className="page-title">
            <h1>Votação no Exterior</h1>
          </div>
          <p className="notice">
            O cadastro oficial do Exterior ainda não está disponível. A abrangência será habilitada
            quando a configuração do TSE puder ser validada.
          </p>
        </main>
      </>
    );
  const scope =
    tab === 'exterior'
      ? catalog!.exteriorCode!
      : tab === 'brasil'
        ? 'br'
        : typeof params.scope === 'string'
          ? params.scope
          : '';
  const office =
    tab === 'brasil' || tab === 'exterior'
      ? '1'
      : typeof params.office === 'string'
        ? params.office
        : '1';
  const municipality = typeof params.municipality === 'string' ? params.municipality : null;
  const query = new URLSearchParams({ scope: scope || 'br', office });
  if (municipality) query.set('municipality', municipality);
  let initial: View | null = fallback;
  try {
    initial = await readView(query);
  } catch {}
  const region = catalog?.regions.find((r) => r.code === scope),
    locality = region?.municipalities.find((m) => m.code === municipality);
  // Send only the selected municipality list to client controls.
  const clientCatalog = catalog
    ? {
        ...catalog,
        regions: catalog.regions.map((r) => ({
          ...r,
          municipalities: r.code === scope ? r.municipalities : [],
        })),
      }
    : null;
  const title =
    tab === 'exterior'
      ? 'Votação no Exterior'
      : office === '1'
        ? 'Presidente da República'
        : (catalog?.offices.find((o) => o.code === office)?.name ?? 'Resultados oficiais');
  const scopeName =
    scope === 'br'
      ? 'Brasil'
      : locality
        ? `${locality.name} · ${region?.name ?? ''}`
        : (region?.name ?? 'Selecione uma abrangência');
  const selected =
    tab === 'brasil' || tab === 'exterior' || (scope && (!municipality || Boolean(locality)));
  let resources: Record<string, Resource<Result> | null> = {};
  if (tab === 'estados' && !scope && catalog) {
    resources = Object.fromEntries(
      await Promise.all(
        catalog.regions
          .filter((r) => !r.exterior)
          .map(async (r) => [
            r.code,
            await getStore().get<Resource<Result>>(
              `result:${catalog.federalElection}:${r.code}:-:1`,
            ),
          ]),
      ),
    );
  }
  let sections: ExteriorSections | null = null;
  if (tab === 'exterior')
    try {
      sections = await getStore().get<ExteriorSections>('exterior:sections');
    } catch {}
  const brazil =
    tab === 'exterior'
      ? await readView(new URLSearchParams('scope=br&office=1')).catch(() => fallback)
      : null;
  const consolidatedExterior =
    tab === 'exterior' && municipality
      ? await readView(new URLSearchParams({ scope, office: '1' })).catch(() => fallback)
      : initial;
  return (
    <>
      <Navigation active={tab} />
      <main id="main" className="container">
        {tab === 'municipios' && (
          <>
            <div className="page-title">
              <div>
                <h1>Resultados por município</h1>
                <p>Encontre a apuração da sua cidade.</p>
              </div>
            </div>
            <Explorer
              catalog={clientCatalog}
              scope={scope}
              municipality={municipality}
              office={office}
            />
          </>
        )}
        {tab === 'estados' && !scope ? (
          <>
            <div className="page-title">
              <div>
                <h1>Apuração nos estados</h1>
                <p>Presidente da República · Selecione uma UF para ver todos os cargos.</p>
              </div>
            </div>
            <StatesList
              catalog={clientCatalog}
              resources={resources}
              released={Boolean(
                initial?.serverNow &&
                Date.parse(initial.serverNow) >= Date.parse(initial.releaseAt),
              )}
            />
          </>
        ) : selected && initial ? (
          <>
            {tab === 'estados' && (
              <a className="back-link" href="/estados">
                ← Todos os estados
              </a>
            )}
            {(tab === 'estados' || tab === 'municipios') && scope && (
              <OfficeSelector
                catalog={clientCatalog}
                scope={scope}
                municipality={municipality}
                office={office}
                base={tab === 'estados' ? '/estados' : '/municipios'}
              />
            )}
            <ResultsLive
              initial={initial}
              query={query.toString()}
              title={title}
              scopeName={scopeName}
            />
            {tab === 'exterior' && (
              <>
                {brazil && consolidatedExterior && (
                  <Comparison brazil={brazil} exterior={consolidatedExterior} scope={scope} />
                )}
                <section className="localities">
                  <h2>Localidades do Exterior</h2>
                  <p>
                    O TSE disponibiliza o consolidado e resultados por localidade. Os arquivos
                    encontrados não informam uma relação de localidades com países; não agrupamos
                    votos por país.
                  </p>
                  <Explorer
                    catalog={clientCatalog}
                    scope={scope}
                    municipality={municipality}
                    office="1"
                    exterior
                  />
                  {sections && (
                    <details>
                      <summary>Consultar zonas e seções oficiais</summary>
                      <div className="sections-list">
                        {sections.localities
                          .filter((m) => !municipality || m.code === municipality)
                          .map((m) => (
                            <details key={m.code}>
                              <summary>{m.name}</summary>
                              {m.zones.map((z) => (
                                <div key={z.code}>
                                  <h3>Zona {z.code}</h3>
                                  <p>
                                    {z.sections
                                      .map(
                                        (s) =>
                                          `${s.number}${s.principal ? ` (agregada à ${s.principal})` : ''}`,
                                      )
                                      .join(' · ')}
                                  </p>
                                </div>
                              ))}
                            </details>
                          ))}
                      </div>
                      <p className="table-note">
                        Cadastro EA16. Seções agregadas não são somadas à totalização; o total é o
                        publicado pelo TSE.
                      </p>
                    </details>
                  )}
                </section>
              </>
            )}
          </>
        ) : scope && !initial ? (
          <p className="notice">
            Esta combinação de cargo e abrangência não está disponível na configuração oficial do
            TSE.
          </p>
        ) : tab !== 'municipios' ? (
          <p className="quiet-note">Selecione uma abrangência para consultar os dados oficiais.</p>
        ) : (
          <p className="quiet-note">
            Selecione o estado e o município para acompanhar os resultados.
          </p>
        )}
      </main>
    </>
  );
}
