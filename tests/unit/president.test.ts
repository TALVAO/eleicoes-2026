import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ea20Schema } from '../../src/lib/tse/schemas';
import { adaptResult } from '../../src/lib/tse/adapters/results';
import {
  candidateColor,
  geographicArea,
  geographicLeader,
  strongestAreas,
  topCandidates,
  type GeographicArea,
} from '../../src/features/president/model';
import { emptyResource } from '../../src/lib/tse/cache';
import type { Provenance } from '../../src/lib/tse/types';
const official = adaptResult(
  ea20Schema.parse(JSON.parse(readFileSync('docs/sources/EA20-BR.json', 'utf8'))),
  '6257:br:-:1',
  '1',
  'br',
  null,
);
const source: Provenance = {
  url: 'https://resultados.tse.jus.br',
  generatedAt: null,
  fetchedAt: new Date().toISOString(),
  hash: 'test',
  validation: 'signature-verified',
  etag: null,
  lastModified: null,
};
describe('Presidential visual model uses official values without estimates', () => {
  it('limits chart to five, sorts official vote totals and breaks ties using official order', () => {
    const result = structuredClone(official);
    result.candidates.forEach((c, i) => {
      c.votes = i * 100;
    });
    const ranked = topCandidates(result);
    expect(ranked).toHaveLength(5);
    expect(ranked[0].votes).toBe(Math.max(...result.candidates.map((c) => c.votes!)));
    result.candidates.forEach((c) => {
      c.votes = 0;
    });
    expect(topCandidates(result).map((c) => c.order)).toEqual(
      result.candidates
        .toSorted((a, b) => a.order - b.order)
        .slice(0, 5)
        .map((c) => c.order),
    );
    result.candidates.forEach((c) => {
      c.votes = null;
    });
    expect(topCandidates(result)).toEqual([]);
  });
  it('never colors preparation, pre-release, absent or tied results as a leader', () => {
    const resource = { ...emptyResource<typeof official>(), current: { data: official, source } };
    expect(
      geographicArea(
        resource,
        'Brasil',
        '2026-10-04T20:00:00Z',
        Date.parse('2026-10-04T19:00:00Z'),
      ),
    ).toBeNull();
    expect(
      geographicArea(
        resource,
        'Brasil',
        '2026-10-04T20:00:00Z',
        Date.parse('2026-10-04T21:00:00Z'),
      ),
    ).toBeNull();
    const result = structuredClone(official);
    result.phase = 'counting';
    const area = geographicArea(
      { ...resource, current: { data: result, source } },
      'Brasil',
      '2026-10-04T20:00:00Z',
      Date.parse('2026-10-04T21:00:00Z'),
    )!;
    expect(geographicLeader(area)).toBeNull();
    area.candidates[0].votes = 100;
    area.candidates[1].votes = 100;
    expect(geographicLeader(area)).toBeNull();
    area.candidates[0].votes = 101;
    expect(geographicLeader(area)?.votes).toBe(101);
  });
  it('ranks by supplied percentage and preserves comma precision and provenance', () => {
    const candidate = official.candidates[0];
    const area = (
      name: string,
      percentage: string | null,
      value: number | null,
    ): GeographicArea => ({
      scope: name,
      municipality: null,
      name,
      candidates: [{ ...candidate, percentage, percentageValue: value }],
      totalization: null,
      source,
      stale: false,
    });
    const rows = strongestAreas(
      [area('a', '49,3210', 49.321), area('b', null, null), area('c', '72,10', 72.1)],
      candidate,
    );
    expect(rows.map((r) => r.area.name)).toEqual(['c', 'a']);
    expect(rows[1].candidate.percentage).toBe('49,3210');
    expect(rows[0].area.source).toBe(source);
  });
  it('keeps candidate colours stable across rank and scope and distinct by official number', () => {
    expect(candidateColor(official.candidates[0])).toBe(
      candidateColor({ number: official.candidates[0].number }),
    );
    expect(
      new Set(official.candidates.map((c) => candidateColor(c, official.candidates))).size,
    ).toBe(official.candidates.length);
  });
});
