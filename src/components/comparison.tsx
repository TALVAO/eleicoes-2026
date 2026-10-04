'use client';
import { useLive } from '@/features/elections/live-store';
import type { View } from '@/lib/tse/types';
export function Comparison({
  brazil,
  exterior,
  scope,
}: {
  brazil: View;
  exterior: View;
  scope: string;
}) {
  const br = useLive('scope=br&office=1', brazil),
    zz = useLive(`scope=${scope}&office=1`, exterior);
  const a = br.view.resource.current?.data,
    b = zz.view.resource.current?.data;
  const ready =
    a &&
    b &&
    a.phase !== 'unreleased' &&
    b.phase !== 'unreleased' &&
    (br.now || Date.parse(br.view.serverNow ?? '2026-10-04T00:00:00-03:00')) >=
      Date.parse(br.view.releaseAt);
  return (
    <section className="comparison">
      <h2>Brasil × Exterior</h2>
      <p className="quiet-note">
        Percentuais oficiais de cada abrangência. O consolidado Brasil inclui o Exterior.
      </p>
      {ready ? (
        <>
          <div className="comparison-heading">
            <span>Candidato</span>
            <span>Brasil</span>
            <span>Exterior</span>
          </div>
          {a.candidates.map((c) => {
            const other = b.candidates.find((x) => x.id === c.id);
            return (
              <div className="comparison-row" key={c.id}>
                <strong>
                  {c.name}
                  <small>{c.party}</small>
                </strong>
                <span>{c.percentage === null ? 'Indisponível' : c.percentage + '%'}</span>
                <span>
                  {other?.percentage === null || other?.percentage === undefined
                    ? 'Indisponível'
                    : other.percentage + '%'}
                </span>
              </div>
            );
          })}
        </>
      ) : (
        <p className="comparison-wait">
          A comparação será exibida quando o TSE divulgar resultados para as duas abrangências.
        </p>
      )}
      {(br.offline ||
        zz.offline ||
        br.connection === 'degraded' ||
        zz.connection === 'degraded' ||
        br.view.resource.status !== 'ok' ||
        zz.view.resource.status !== 'ok' ||
        br.view.health?.status === 'degraded' ||
        zz.view.health?.status === 'degraded') && (
        <p className="notice">
          A comparação pode conter o último resultado recebido. Confira os horários dos arquivos.
        </p>
      )}
      <div className="comparison-timestamps">
        <span>
          Brasil:{' '}
          {a?.generatedAt
            ? new Date(a.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            : 'indisponível'}
        </span>
        <span>
          Exterior:{' '}
          {b?.generatedAt
            ? new Date(b.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
            : 'indisponível'}
        </span>
      </div>
    </section>
  );
}
