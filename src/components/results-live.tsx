'use client';
import { memo, useState } from 'react';
import Image from 'next/image';
import {
  Clock3,
  ShieldCheck,
  WifiOff,
  ArrowUpRight,
  Radio,
  UserRound,
  AlertCircle,
} from 'lucide-react';
import type { Candidate, Metrics, Result, View, UpdateEvent, Provenance } from '@/lib/tse/types';
import { useLive } from '@/features/elections/live-store';
import { difference } from '@/lib/tse/adapters/results';
import {
  PresidentialChart,
  BrazilMap,
  GeographicHighlights,
  useGeography,
} from './presidential-hero';
export const number = (value: number | null) =>
  value === null ? 'Ainda não disponível' : value.toLocaleString('pt-BR');
export const clock = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(iso))
    : 'Ainda não disponível';
export const dateClock = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(iso))
    : 'Ainda não disponível';
const CandidateRow = memo(function CandidateRow({
  candidate,
  index,
}: {
  candidate: Candidate;
  index: number;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <li className="candidate-row">
      <div className="candidate-avatar">
        {candidate.photo && !photoFailed ? (
          <Image
            src={candidate.photo}
            alt=""
            width={52}
            height={52}
            unoptimized
            loading={index < 3 ? 'eager' : 'lazy'}
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <UserRound size={24} aria-hidden="true" />
        )}
      </div>
      <div className="candidate-info">
        <h3>{candidate.name}</h3>
        <p>
          {candidate.party} <span aria-hidden="true">·</span> {candidate.number}
          {candidate.status && <span className="candidate-status">{candidate.status}</span>}
        </p>
        {candidate.percentageValue !== null && (
          <div className="vote-bar" aria-hidden="true">
            <span style={{ width: `${candidate.percentageValue}%` }} />
          </div>
        )}
      </div>
      <div className="candidate-numbers">
        <strong>{candidate.percentage === null ? '—' : `${candidate.percentage}%`}</strong>
        <span>
          {candidate.votes === null ? 'Votos não disponíveis' : `${number(candidate.votes)} votos`}
        </span>
      </div>
    </li>
  );
});
const CandidateList = memo(function CandidateList({ result }: { result: Result }) {
  const [limit, setLimit] = useState(50);
  return (
    <>
      <h2 className="sr-only">Resultado por candidato</h2>
      <div className="results-table-heading">
        <span>Candidato / partido</span>
        <span>Votos computados</span>
      </div>
      <ol className="candidate-list">
        {result.candidates.slice(0, limit).map((candidate, index) => (
          <CandidateRow key={candidate.id} candidate={candidate} index={index} />
        ))}
      </ol>
      {limit < result.candidates.length && (
        <button className="text-link" type="button" onClick={() => setLimit((n) => n + 50)}>
          Mostrar mais candidatos
        </button>
      )}
      {!result.candidates.length && (
        <p className="quiet-note">O TSE ainda não disponibilizou candidatos para este cargo.</p>
      )}
      <p className="table-note">
        Ordem e percentuais fornecidos pelo TSE. Votos computados podem incluir votos com destinação
        anulada ou sub judice.
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
    </>
  );
});
const Totalization = memo(function Totalization({
  metrics,
  available,
  id = 'totalization-title',
}: {
  metrics: Metrics | undefined;
  available: boolean;
  id?: string;
}) {
  const entries: [string, number | null | undefined][] = [
    ['Seções totalizadas', metrics?.totalized],
    ['Seções pendentes', metrics?.pending],
    ['Votos computados', metrics?.votes],
    ['Votos válidos', metrics?.valid],
    ['Comparecimento', metrics?.turnout],
    ['Abstenções', metrics?.abstention],
    ['Brancos', metrics?.blank],
    ['Nulos (inclui técnicos)', metrics?.null],
  ];
  return (
    <section className="totalization" aria-labelledby={id}>
      <h2 id={id}>Totalização</h2>
      {available &&
      metrics?.totalizedPercent !== null &&
      metrics?.totalizedPercent !== undefined ? (
        <>
          <p className="totalization-value">
            {metrics.totalizedPercent}
            <span>%</span>
          </p>
          <p className="totalization-caption">das seções totalizadas</p>
          <progress
            value={metrics.totalizedPercentValue ?? 0}
            max="100"
            aria-label="Seções totalizadas"
          />
        </>
      ) : (
        <>
          <p className="totalization-wait">
            Aguardando
            <br />
            dados oficiais.
          </p>
          <p className="totalization-caption">
            O progresso aparecerá assim que o TSE iniciar a divulgação.
          </p>
          <div className="waiting-rule" />
        </>
      )}
      {available && (
        <dl className="metrics">
          {entries
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{number(value!)}</dd>
              </div>
            ))}
        </dl>
      )}
      <p className="source-note">
        <ShieldCheck size={15} aria-hidden="true" /> Fonte: Tribunal Superior Eleitoral
      </p>
    </section>
  );
});
const Difference = memo(function Difference({ result }: { result: Result }) {
  const d = difference(result);
  if (!d || (d.votes === null && d.points === null)) return null;
  return (
    <section className="difference">
      <h2>Diferença entre 1º e 2º</h2>
      {d.votes !== null && (
        <strong>
          {number(d.votes)} <span>votos</span>
        </strong>
      )}
      {d.points !== null && (
        <p>
          {d.points > 0 ? '+' : ''}
          {d.points.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} p.p.
        </p>
      )}
      <small>Métrica derivada dos valores oficiais, na ordem do TSE.</small>
    </section>
  );
});
const Feed = memo(function Feed({ events }: { events: UpdateEvent[] }) {
  return (
    <section className="feed">
      <h2>Últimas atualizações</h2>
      {events.length ? (
        <ol>
          {events.slice(0, 6).map((event) => (
            <li key={event.id}>
              <time dateTime={event.at}>{clock(event.at)}</time>
              <p>{event.message}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="quiet-note">
          As mudanças na apuração aparecerão aqui, comparando os resultados oficiais recebidos.
        </p>
      )}
      <p className="table-note">Eventos derivados de snapshots oficiais.</p>
    </section>
  );
});
const Freshness = memo(function Freshness({ source }: { source: Provenance | null }) {
  return (
    <div className="freshness">
      <div>
        <Clock3 size={15} aria-hidden="true" />
        <span>
          Dados do TSE <strong>{dateClock(source?.generatedAt ?? null)}</strong>
        </span>
      </div>
      <div>
        <span>
          Recebido por este servidor <strong>{dateClock(source?.fetchedAt ?? null)}</strong>
        </span>
      </div>
      {source && (
        <a href={source.url} target="_blank" rel="noreferrer">
          Ver arquivo oficial <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      )}
    </div>
  );
});
export function ResultsLive({
  initial,
  query,
  title,
  scopeName,
  presidential = false,
}: {
  initial: View;
  query: string;
  title: string;
  scopeName: string;
  presidential?: boolean;
}) {
  const { view, offline, connection, now } = useLive(query, initial, scopeName);
  const resource = view.resource;
  const snapshot = resource.current;
  const result = snapshot?.data;
  const currentTime = now || Date.parse(view.serverNow ?? '2026-10-04T00:00:00-03:00');
  const beforeRelease = currentTime < Date.parse(view.releaseAt);
  const available = Boolean(
    result && result.phase !== 'unreleased' && (!beforeRelease || result.office !== '1'),
  );
  const sourceProblem = resource.status !== 'ok' && resource.status !== 'unpublished';
  const workerOld =
    !view.health?.heartbeatAt || (now > 0 && now - Date.parse(view.health.heartbeatAt) > 45_000);
  const degraded =
    sourceProblem || workerOld || connection === 'degraded' || view.health?.status === 'degraded';
  const recent =
    snapshot && currentTime - Date.parse(snapshot.source.fetchedAt) < 30_000 && available;
  const label = degraded
    ? 'Conexão com o TSE instável'
    : recent
      ? 'Ao vivo'
      : 'Aguardando atualização';
  const signatureError =
    resource.status === 'invalid-signature' ||
    resource.status === 'schema-incompatible' ||
    resource.status === 'invalid-json';
  const national = presidential;
  const geography = useGeography(national);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>{title}</h1>
          <p>
            {scopeName}
            {result?.phase === 'final' ? ' · Totalização finalizada' : ''}
          </p>
        </div>
        <div className={`live-label ${degraded ? 'is-degraded' : ''}`} role="status">
          <span className="status-dot" />
          {label}
        </div>
      </div>
      {offline ? (
        <div className="notice" role="status">
          <WifiOff size={18} aria-hidden="true" />
          Sem conexão.{' '}
          {snapshot
            ? `Exibindo último resultado recebido às ${dateClock(snapshot.source.fetchedAt)}.`
            : 'Nenhum resultado está salvo neste dispositivo.'}
        </div>
      ) : (
        degraded && (
          <div className="notice" role="status">
            <AlertCircle size={18} aria-hidden="true" />
            {signatureError
              ? 'Falha temporária ao validar dados oficiais.'
              : workerOld
                ? 'A conexão de atualização está temporariamente indisponível.'
                : 'Não foi possível atualizar os dados oficiais neste momento.'}
            {snapshot && ' Exibindo o último snapshot válido.'}
          </div>
        )
      )}
      <div className={`results-grid ${national ? 'national-dashboard' : ''}`}>
        <div className="main-results">
          {available && result ? (
            national ? (
              <PresidentialChart result={result} />
            ) : (
              <CandidateList result={result} />
            )
          ) : (
            <section className="waiting-state">
              <div className="waiting-symbol">
                <Radio size={30} strokeWidth={1.3} aria-hidden="true" />
              </div>
              <h2>
                {resource.status === 'unpublished' && !result && !beforeRelease
                  ? 'Resultado ainda não divulgado'
                  : beforeRelease || result?.phase === 'unreleased'
                    ? 'Apuração ainda não liberada'
                    : 'Aguardando dados oficiais'}
              </h2>
              <p>
                {beforeRelease
                  ? 'A divulgação oficial dos resultados presidenciais será liberada pelo TSE a partir das 17h, horário de Brasília.'
                  : 'Os resultados desta abrangência ainda não estão disponíveis para exibição.'}
              </p>
              <div className="waiting-detail">
                <span className="status-dot" />
                <span>
                  {view.health?.status === 'healthy' && !workerOld
                    ? 'O sistema está conectado e aguardando dados oficiais.'
                    : 'O sistema tentará restabelecer a atualização automaticamente.'}
                </span>
              </div>
              <a
                className="text-link"
                href="https://resultados.tse.jus.br"
                target="_blank"
                rel="noreferrer"
              >
                Acessar o portal do TSE <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </section>
          )}
          {national && (
            <div className="mobile-totalization">
              <Totalization
                metrics={result?.metrics}
                available={available}
                id="mobile-totalization-title"
              />
            </div>
          )}
          <Freshness source={snapshot?.source ?? null} />
          {national && available && result && (
            <GeographicHighlights result={result} data={geography.data} />
          )}
          {available && result && <Difference result={result} />}
          <Feed events={view.events} />
        </div>
        <aside>
          {national && (
            <BrazilMap
              data={geography.data}
              stale={geography.stale}
              allowed={available}
              candidates={result?.candidates ?? []}
            />
          )}
          <Totalization metrics={result?.metrics} available={available} />
          <section className="reading-guide">
            <h2>Uma apuração, com transparência.</h2>
            <p>
              Cada voto e percentual vem da fonte oficial. Quando um dado ainda não foi publicado,
              ele permanece indisponível.
            </p>
            <a className="text-link" href="/sobre">
              Entenda os dados <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </section>
        </aside>
      </div>
    </>
  );
}
