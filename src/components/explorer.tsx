'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight } from 'lucide-react';
import type { Catalog, Resource, Result } from '@/lib/tse/types';
export function Explorer({
  catalog,
  scope,
  municipality,
  office,
  exterior = false,
}: {
  catalog: Catalog | null;
  scope: string;
  municipality?: string | null;
  office: string;
  exterior?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const region = catalog?.regions.find((r) => r.code === scope);
  const regions = catalog?.regions.filter((r) => !r.exterior) ?? [];
  const localities =
    region?.municipalities.filter((m) =>
      m.name
        .toLocaleLowerCase('pt-BR')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .includes(
          search
            .toLocaleLowerCase('pt-BR')
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, ''),
        ),
    ) ?? [];
  const navigate = (newScope: string, newMunicipality: string | null, newOffice = office) => {
    const p = new URLSearchParams({ scope: newScope, office: newOffice });
    if (newMunicipality) p.set('municipality', newMunicipality);
    router.push(`${exterior ? '/exterior' : '/municipios'}?${p}`);
  };
  if (!catalog)
    return (
      <p className="notice">
        A configuração oficial de estados e municípios ainda não está disponível.
      </p>
    );
  return (
    <section
      className="explorer"
      aria-label={exterior ? 'Buscar localidade do exterior' : 'Escolher município'}
    >
      <div className="form-row">
        {!exterior && (
          <div>
            <label htmlFor="region-select">Estado</label>
            <select
              id="region-select"
              value={scope}
              onChange={(e) => navigate(e.target.value, null, '1')}
            >
              <option value="">Selecione um estado</option>
              {regions.map((r) => (
                <option value={r.code} key={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="locality-search">Buscar {exterior ? 'localidade' : 'município'}</label>
          <div className="search-field">
            <Search size={17} aria-hidden="true" />
            <input
              id="locality-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={exterior ? 'Nome da localidade' : 'Nome do município'}
              disabled={!region}
            />
          </div>
        </div>
        <div>
          <label htmlFor="locality-select">{exterior ? 'Localidade' : 'Município'}</label>
          <select
            id="locality-select"
            value={municipality ?? ''}
            disabled={!region}
            onChange={(e) => navigate(scope, e.target.value || null)}
          >
            <option value="">
              {exterior ? 'Consolidado do Exterior' : 'Selecione um município'}
            </option>
            {localities.map((m) => (
              <option value={m.code} key={m.code}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {search && localities.length === 0 && (
        <p className="quiet-note">Nenhuma localidade encontrada na configuração oficial.</p>
      )}
    </section>
  );
}
export function OfficeSelector({
  catalog,
  scope,
  municipality,
  office,
  base,
}: {
  catalog: Catalog | null;
  scope: string;
  municipality: string | null;
  office: string;
  base: string;
}) {
  const offices =
    catalog?.offices.filter(
      (o) =>
        o.regions.includes(scope) &&
        (o.code !== '7' || scope !== 'df') &&
        (o.code !== '8' || scope === 'df'),
    ) ?? [];
  return (
    <nav className="office-selector" aria-label="Cargo">
      {offices.map((o) => {
        const p = new URLSearchParams({ scope, office: o.code });
        if (municipality) p.set('municipality', municipality);
        return (
          <Link
            key={o.code}
            href={base + '?' + p.toString()}
            aria-current={o.code === office ? 'page' : undefined}
          >
            {o.name}
          </Link>
        );
      })}
    </nav>
  );
}
export function StatesList({
  catalog,
  resources,
  released,
}: {
  catalog: Catalog | null;
  resources: Record<string, Resource<Result> | null>;
  released: boolean;
}) {
  const [current, setCurrent] = useState(resources),
    [stale, setStale] = useState(false),
    [allowed, setAllowed] = useState(released);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setInterval(() => {
      void fetch('/api/states', { signal: controller.signal, cache: 'no-store' })
        .then(async (r) => {
          if (!r.ok) throw new Error('Unavailable');
          setCurrent((await r.json()) as typeof resources);
          setAllowed(
            Boolean(
              catalog &&
              Date.now() >=
                Date.parse(`${catalog.date.split('/').reverse().join('-')}T17:00:00-03:00`),
            ),
          );
          setStale(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setStale(true);
        });
    }, 15000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [catalog]);
  return (
    <>
      {stale && (
        <p className="notice">
          Não foi possível atualizar a lista. Exibindo os últimos resultados recebidos.
        </p>
      )}
      <div className="states-list">
        {catalog?.regions
          .filter((r) => !r.exterior)
          .map((r) => {
            const result = current[r.code]?.current?.data;
            const candidate =
              allowed && result?.phase !== 'unreleased' ? result?.candidates[0] : null;
            return (
              <Link href={`/estados?scope=${r.code}&office=1`} key={r.code}>
                <span className="uf-code">{r.code.toUpperCase()}</span>
                <div>
                  <strong>{r.name}</strong>
                  <span>{candidate ? candidate.name : 'Aguardando dados oficiais'}</span>
                  {result && current[r.code]?.status !== 'ok' && (
                    <small>Último arquivo válido · atualização indisponível</small>
                  )}
                </div>
                <div className="state-values">
                  {candidate && (
                    <strong>
                      {candidate.percentage === null ? '—' : candidate.percentage + '%'}
                    </strong>
                  )}
                  <small>
                    {allowed &&
                    result &&
                    result.phase !== 'unreleased' &&
                    result.metrics.totalizedPercent !== null
                      ? `${result.metrics.totalizedPercent}% totalizado`
                      : 'Ainda não divulgado'}
                  </small>
                </div>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            );
          })}
      </div>
    </>
  );
}
