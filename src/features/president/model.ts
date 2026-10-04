import type { Candidate, Resource, Result, Provenance } from '@/lib/tse/types';
// Stable across ranks, regions and refreshes. These are editorial colours, not party branding.
const palette = [
  '#246b9b',
  '#6954a0',
  '#a84d38',
  '#61733c',
  '#9b487c',
  '#526b82',
  '#287668',
  '#956415',
  '#454f98',
  '#9a534c',
  '#3d777e',
  '#765636',
];
export function candidateColor(
  candidate: Pick<Candidate, 'number'>,
  all: Pick<Candidate, 'number'>[] = [],
) {
  const numbers = [...new Set(all.map((c) => c.number))].toSorted((a, b) => Number(a) - Number(b));
  const index = numbers.indexOf(candidate.number);
  if (index >= 0 && index < palette.length) return palette[index];
  return `hsl(${(Number(candidate.number) * 137.508) % 360} 48% 39%)`;
}
export function topCandidates(result: Result) {
  return result.candidates
    .filter((c) => c.votes !== null)
    .toSorted((a, b) => b.votes! - a.votes! || a.order - b.order)
    .slice(0, 5);
}
export interface GeographicArea {
  scope: string;
  municipality: string | null;
  name: string;
  candidates: Candidate[];
  totalization: string | null;
  source: Provenance;
  stale: boolean;
}
export interface GeographyView {
  states: GeographicArea[];
  municipalities: GeographicArea[];
  expectedStates: number;
  observedMunicipalities: number;
  totalMunicipalities: number;
}
export function geographicArea(
  resource: Resource<Result> | null,
  name: string,
  releaseAt: string,
  now: number,
): GeographicArea | null {
  const snapshot = resource?.current;
  if (!snapshot || snapshot.data.phase === 'unreleased' || now < Date.parse(releaseAt)) return null;
  return {
    scope: snapshot.data.scope,
    municipality: snapshot.data.municipality,
    name,
    candidates: snapshot.data.candidates,
    totalization: snapshot.data.metrics.totalizedPercent,
    source: snapshot.source,
    stale: resource!.status !== 'ok',
  };
}
export function geographicLeader(area: GeographicArea) {
  const candidates = area.candidates.filter((c) => c.votes !== null);
  if (!candidates.length) return null;
  const ranked = candidates.toSorted((a, b) => b.votes! - a.votes! || a.order - b.order);
  // Zero and tied vote totals do not establish a unique geographic leader.
  if (ranked[0].votes === 0 || ranked[0].votes === ranked[1]?.votes) return null;
  return ranked[0];
}
export function strongestAreas(areas: GeographicArea[], candidate: Candidate) {
  return areas
    .map((area) => ({
      area,
      candidate: area.candidates.find(
        (c) => c.number === candidate.number && c.party === candidate.party,
      ),
    }))
    .filter(
      (entry): entry is { area: GeographicArea; candidate: Candidate } =>
        entry.candidate?.percentageValue !== null && entry.candidate?.percentageValue !== undefined,
    )
    .toSorted(
      (a, b) =>
        b.candidate.percentageValue! - a.candidate.percentageValue! ||
        a.area.name.localeCompare(b.area.name, 'pt-BR'),
    )
    .slice(0, 3);
}
