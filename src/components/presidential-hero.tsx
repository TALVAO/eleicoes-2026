'use client';
import { memo, useEffect, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ThumbsDown, ThumbsUp, UserRound, ArrowUpRight } from 'lucide-react';
import type { Candidate, Result } from '@/lib/tse/types';
import type { ReactionCounts, Reaction } from '@/server/reactions';
import {
  candidateColor,
  geographicLeader,
  strongestAreas,
  topCandidates,
  type GeographyView,
} from '@/features/president/model';
import shapes from '@/features/president/map-shapes.json';

const format = (n: number) => n.toLocaleString('pt-BR');
export function useGeography(enabled: boolean) {
  const [data, setData] = useState<GeographyView | null>(null);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false,
      etag: string | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    let running = false;
    const poll = async () => {
      if (stopped || running || document.hidden || !navigator.onLine) return;
      running = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8000);
      try {
        const response = await fetch('/api/geography', {
          signal: controller.signal,
          headers: etag ? { 'If-None-Match': etag } : {},
        });
        if (response.status !== 304) {
          if (!response.ok) throw new Error('Unavailable');
          const payload = (await response.json()) as GeographyView;
          if (!Array.isArray(payload.states) || !Array.isArray(payload.municipalities))
            throw new Error('Invalid');
          if (!stopped) setData(payload);
          etag = response.headers.get('etag');
        }
        if (!stopped) setStale(false);
      } catch {
        if (!stopped) setStale(true);
      } finally {
        running = false;
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(() => void poll(), 5000);
      }
    };
    const resume = () => {
      clearTimeout(timer);
      void poll();
    };
    void poll();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, [enabled]);
  return { data, stale };
}
const ChartRow = memo(function ChartRow({
  candidate,
  color,
  index,
  counts,
  busy,
  react,
}: {
  candidate: Candidate;
  color: string;
  index: number;
  counts?: ReactionCounts;
  busy: boolean;
  react: (id: string, value: Reaction) => void;
}) {
  const [failedPhoto, setFailedPhoto] = useState(false);
  return (
    <li className="race-row candidate-row" style={{ '--candidate-color': color } as CSSProperties}>
      <div className="race-row-top">
        <span className="race-rank" aria-label={`${index + 1}º lugar`}>
          {index + 1}
        </span>
        <div className="race-avatar">
          {candidate.photo && !failedPhoto ? (
            <Image
              src={candidate.photo}
              alt=""
              width={44}
              height={44}
              unoptimized
              onError={() => setFailedPhoto(true)}
            />
          ) : (
            <UserRound size={22} aria-hidden="true" />
          )}
        </div>
        <div className="race-name">
          <h3>{candidate.name}</h3>
          <p>
            {candidate.party} <span aria-hidden="true">·</span> Nº {candidate.number}
          </p>
        </div>
        <div className="race-values">
          <strong>{candidate.percentage === null ? '—' : `${candidate.percentage}%`}</strong>
          <span>
            {candidate.votes === null
              ? 'Votos não disponíveis'
              : `${format(candidate.votes)} votos`}
          </span>
        </div>
      </div>
      {candidate.percentageValue !== null && (
        <div className="race-track" aria-hidden="true">
          <span style={{ transform: `scaleX(${candidate.percentageValue / 100})` }} />
        </div>
      )}
      <div className="race-row-bottom">
        <span className="race-official-status">
          {candidate.status ?? 'Resultado oficial do TSE'}
        </span>
        <div className="reaction-buttons" aria-label={`Reações a ${candidate.name}`}>
          {(['like', 'dislike'] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              aria-pressed={counts?.selected === value}
              aria-label={`${value === 'like' ? 'Curtir' : 'Não curtir'} ${candidate.name}`}
              onClick={() => react(candidate.id, counts?.selected === value ? null : value)}
            >
              {value === 'like' ? (
                <ThumbsUp size={15} aria-hidden="true" />
              ) : (
                <ThumbsDown size={15} aria-hidden="true" />
              )}
              <span>{counts ? format(counts[value]) : '—'}</span>
            </button>
          ))}
        </div>
      </div>
    </li>
  );
});
export const PresidentialChart = memo(function PresidentialChart({ result }: { result: Result }) {
  const candidates = topCandidates(result);
  const [counts, setCounts] = useState<Record<string, ReactionCounts>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      if (running || document.hidden || !navigator.onLine) return;
      running = true;
      try {
        const response = await fetch('/api/chat/reactions', { signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const data = await response.json();
        setCounts(data.counts);
        setMessage('');
      } catch {
        if (!controller.signal.aborted)
          setMessage('As reações estão temporariamente indisponíveis.');
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [result.election]);
  const react = async (candidate: string, value: Reaction) => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/chat/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, value }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Não foi possível salvar sua reação.');
      setCounts(data.counts);
      setMessage('Reação registrada.');
    } catch {
      setMessage('Não foi possível salvar sua reação agora. Aguarde e tente novamente.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="presidential-chart" aria-labelledby="race-title">
      <div className="race-heading">
        <div>
          <h2 id="race-title">Os cinco mais votados</h2>
        </div>
        <span>Votos do TSE</span>
      </div>
      <ol className="race-list">
        {candidates.map((candidate, index) => (
          <ChartRow
            key={candidate.id}
            candidate={candidate}
            color={candidateColor(candidate, result.candidates)}
            index={index}
            counts={counts[candidate.id]}
            busy={busy}
            react={(id, value) => void react(id, value)}
          />
        ))}
      </ol>
      {!candidates.length && (
        <p className="quiet-note">Os votos por candidato ainda não estão disponíveis.</p>
      )}
      <p className="table-note">
        Percentuais oficiais. Empates preservam a ordem do TSE. As cores são editoriais.
      </p>
      {result.withoutElected && (
        <p className="notice">O TSE informa eleição sem atribuição de eleito.</p>
      )}
      {result.mathematicallyDefined && result.mathematicallyDefined !== 'not-defined' && (
        <p className="notice">
          Segundo o TSE, a eleição está matematicamente definida:{' '}
          {result.mathematicallyDefined === 'second-turn' ? 'segundo turno' : 'eleito'}. Consulte a
          situação oficial de cada candidato.
        </p>
      )}
      <div className="reactions-note">
        <ThumbsUp size={15} aria-hidden="true" />
        <span>
          Likes e dislikes são reações dos visitantes. Não são votos nem pesquisa eleitoral. Uma
          escolha por navegador, sem verificação de identidade.
        </span>
      </div>
      <p className="reaction-message" role="status">
        {message}
      </p>
      <Link className="text-link" href="/estados?scope=br&office=1">
        Ver todos os candidatos <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </section>
  );
});
export const BrazilMap = memo(function BrazilMap({
  data,
  stale,
  allowed,
  candidates,
}: {
  data: GeographyView | null;
  stale: boolean;
  allowed: boolean;
  candidates: Candidate[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const states = allowed ? (data?.states ?? []) : [];
  const area = states.find((a) => a.scope === selected);
  const leader = area ? geographicLeader(area) : null;
  const leaders = [
    ...new Map(
      states
        .map((a) => geographicLeader(a))
        .filter((c) => c !== null)
        .map((c) => [c.number, c]),
    ).values(),
  ];
  return (
    <section className="brazil-map" aria-labelledby="map-title">
      <h2 id="map-title">Quem lidera em cada estado</h2>
      <p className="map-caption">Selecione um estado para explorar a apuração.</p>
      <svg viewBox="-8 -8 550 480" role="group" aria-label="Mapa interativo do Brasil">
        {shapes.map((shape) => {
          const state = states.find((a) => a.scope === shape.uf);
          const candidate = state ? geographicLeader(state) : null;
          const label = `${shape.uf.toUpperCase()}: ${candidate ? `${candidate.name}, ${candidate.percentage === null ? 'percentual indisponível' : candidate.percentage + '%'}` : 'sem liderança disponível'}`;
          return (
            <path
              key={shape.uf}
              d={shape.d}
              fill={candidate ? candidateColor(candidate, candidates) : '#dce2dd'}
              stroke="#f7f8f6"
              strokeWidth="1.6"
              fillRule="evenodd"
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={selected === shape.uf}
              onClick={() => setSelected(shape.uf)}
              onFocus={() => setSelected(shape.uf)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(shape.uf);
                }
              }}
            >
              <title>{label}</title>
            </path>
          );
        })}
      </svg>
      <div className="map-detail" aria-live="polite">
        {selected ? (
          <>
            <strong>{area?.name ?? selected.toUpperCase()}</strong>
            <p>
              {leader
                ? `${leader.name} · ${leader.party} · ${leader.percentage === null ? 'Percentual indisponível' : leader.percentage + '%'}`
                : 'Sem liderança disponível nos dados oficiais.'}
            </p>
            {area && (
              <small>
                {area.totalization === null
                  ? 'Totalização não disponível'
                  : `${area.totalization}% das seções totalizadas`}
                {area.stale ? ' · Último snapshot válido' : ''}
              </small>
            )}
            <Link href={`/estados?scope=${selected}&office=1`} className="text-link">
              Abrir estado <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <p>
            {states.length
              ? 'A cor indica o candidato com mais votos computados no estado. Liderança não significa eleição definida.'
              : 'O mapa será colorido quando o TSE liberar os resultados estaduais.'}
          </p>
        )}
      </div>
      <ul className="map-legend">
        {leaders.map((c) => (
          <li key={c.number}>
            <span style={{ background: candidateColor(c, candidates) }} />
            <span>
              {c.name} <small>{c.party}</small>
            </span>
          </li>
        ))}
        <li>
          <span className="map-unavailable" />
          <span>Sem liderança disponível</span>
        </li>
      </ul>
      {stale && (
        <p className="notice">Mapa sem atualização. Exibindo os últimos dados recebidos.</p>
      )}
      <p className="table-note">
        Resultados: TSE · Malha:{' '}
        <a
          href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3"
          target="_blank"
          rel="noreferrer"
        >
          IBGE
        </a>
        .{' '}
        {data &&
          allowed &&
          `${data.states.length} de ${data.expectedStates} UFs com resultado disponível.`}
      </p>
    </section>
  );
});
export const GeographicHighlights = memo(function GeographicHighlights({
  result,
  data,
}: {
  result: Result;
  data: GeographyView | null;
}) {
  const candidates = topCandidates(result).slice(0, 2);
  return (
    <section className="geographic-highlights" aria-labelledby="highlights-title">
      <h2 id="highlights-title">Onde os dois primeiros têm maior percentual</h2>
      <p className="quiet-note">
        Comparação dos percentuais oficiais recebidos. Cada localidade está em uma etapa da
        apuração.
      </p>
      <div className="highlights-grid">
        {candidates.map((c) => (
          <article key={c.id}>
            <h3>
              <span style={{ background: candidateColor(c, result.candidates) }} />
              {c.name}
            </h3>
            <p className="quiet-note">
              {c.party} · Nº {c.number}
            </p>
            {(['states', 'municipalities'] as const).map((kind) => {
              const areas = strongestAreas(data?.[kind] ?? [], c);
              return (
                <div key={kind}>
                  <h4>{kind === 'states' ? 'Estados' : 'Municípios consultados'}</h4>
                  {areas.length ? (
                    <ol>
                      {areas.map(({ area, candidate }) => (
                        <li key={area.scope + area.municipality}>
                          <Link
                            href={`/${kind === 'states' ? 'estados' : 'municipios'}?scope=${area.scope}&office=1${area.municipality ? '&municipality=' + area.municipality : ''}`}
                          >
                            <span>
                              {area.name}
                              <small>
                                {area.totalization === null
                                  ? 'Totalização indisponível'
                                  : `${area.totalization}% totalizado`}
                                {area.stale ? ' · último dado válido' : ''}
                              </small>
                            </span>
                            <strong>{candidate.percentage}%</strong>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="quiet-note">Ainda não há percentuais oficiais disponíveis.</p>
                  )}
                </div>
              );
            })}
          </article>
        ))}
      </div>
      <p className="table-note">
        Municípios: comparação apenas entre os resultados consultados neste painel, sem cobertura
        nacional completa.{' '}
        {data &&
          `${data.observedMunicipalities} de ${data.totalMunicipalities} municípios com resultado disponível.`}{' '}
        Os arquivos podem ter horários diferentes; abra a localidade para conferir a procedência.
      </p>
    </section>
  );
});
