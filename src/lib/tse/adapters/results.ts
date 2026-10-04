import type { EA20 } from '../schemas';
import type { Candidate, Metrics, Result } from '../types';
import { officialTimestamp } from '../validation';
export const count = (value: string | undefined): number | null =>
  value === undefined ? null : Number(value);
export const percentage = (value: string | undefined): number | null =>
  value === undefined ? null : Number(value.replace(',', '.'));
export function adaptResult(
  raw: EA20,
  key: string,
  office: string,
  scope: string,
  municipality: string | null,
  photoUrl?: (id: string) => string,
): Result {
  const cargo = raw.carg.find((c) => c.cd === office);
  if (!cargo) throw new Error('Office absent');
  const candidates: Candidate[] = cargo.agr
    .flatMap((a) =>
      a.par.flatMap((p) =>
        p.cand.map((c) => ({
          id: c.sqcand,
          name: c.nmu || c.nm,
          party: p.sg,
          number: c.n,
          order: Number(c.seq),
          votes: count(c.vap),
          percentage: c.pvap ?? null,
          percentageValue: percentage(c.pvap),
          elected:
            c.e === undefined
              ? null
              : c.e === 's' && /^Eleito(?: por (?:QP|média))?$/i.test(c.st ?? ''),
          status: c.st || null,
          photo: photoUrl?.(c.sqcand) ?? null,
        })),
      ),
    )
    .sort((a, b) => a.order - b.order);
  if (new Set(candidates.map((c) => c.id)).size !== candidates.length)
    throw new Error('Duplicate official candidate identity');
  const metrics: Metrics = {
    sections: count(raw.s?.ts),
    totalized: count(raw.s?.st),
    pending: count(raw.s?.snt),
    totalizedPercent: raw.s?.pst ?? null,
    totalizedPercentValue: percentage(raw.s?.pst),
    votes: count(raw.v?.tv),
    valid: count(raw.v?.vv),
    blank: count(raw.v?.vb),
    null: count(raw.v?.tvn),
    turnout: count(raw.e?.c),
    abstention: count(raw.e?.a),
  };
  return {
    key,
    election: raw.ele,
    office,
    scope,
    municipality,
    officeName: cargo.nmn,
    phase:
      raw.and === 'n' || raw.dv === 'n' ? 'unreleased' : raw.and === 'f' ? 'final' : 'counting',
    candidates,
    metrics,
    mathematicallyDefined:
      raw.md === undefined
        ? null
        : raw.md === 'e'
          ? 'elected'
          : raw.md === 's'
            ? 'second-turn'
            : 'not-defined',
    withoutElected: raw.esae === undefined ? null : raw.esae === 's',
    generatedAt: officialTimestamp(raw.dg, raw.hg),
    totalizedAt: officialTimestamp(raw.dt, raw.ht),
  };
}
export function difference(result: Result): { votes: number | null; points: number | null } | null {
  if (result.phase === 'unreleased' || result.candidates.length < 2) return null;
  const [a, b] = result.candidates;
  return {
    votes: a.votes !== null && b.votes !== null ? a.votes - b.votes : null,
    points:
      a.percentageValue !== null && b.percentageValue !== null
        ? a.percentageValue - b.percentageValue
        : null,
  };
}
