import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ea11Schema,
  ea12Schema,
  ea20Schema,
  ea16Schema,
  trackingSchema,
  percent,
  integer,
} from '../../src/lib/tse/schemas';
import { adaptCatalog, electionConfig } from '../../src/lib/tse/adapters/elections';
import { adaptResult, difference } from '../../src/lib/tse/adapters/results';
import { TSEExteriorAdapter } from '../../src/lib/tse/adapters/exterior';
import { assertOfficialUrl, officialDirectory, resultFilename } from '../../src/lib/tse/urls';
import { verifyOfficialJws } from '../../src/lib/tse/validation';
import { commitSnapshot, emptyResource, snapshotEvents } from '../../src/lib/tse/cache';
import { resolveQuery } from '../../src/server/query';
import type { Provenance } from '../../src/lib/tse/types';
import type { View } from '../../src/lib/tse/types';
import { shareUnchanged } from '../../src/features/elections/sharing';
const load = (name: string) => JSON.parse(readFileSync(`docs/sources/${name}.json`, 'utf8'));
const source: Provenance = {
  url: 'https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.jws',
  generatedAt: null,
  fetchedAt: '2026-10-04T20:00:01Z',
  etag: 'a',
  lastModified: null,
  hash: 'one',
  validation: 'signature-verified',
};
const conf = ea11Schema.parse(load('ele-c')),
  mu = ea12Schema.parse(load('EA12')),
  raw = ea20Schema.parse(load('EA20-BR'));
const catalog = adaptCatalog(conf, mu, source, '04/10/2026', '1');
const result = adaptResult(raw, '6257:br:-:1', '1', 'br', null);
describe('Official captured 2026 fixtures', () => {
  it('validates election, municipalities, results, tracking and sections', () => {
    expect(catalog.pleito).toBe('3220');
    expect(catalog.federalElection).toBe('6257');
    expect(trackingSchema.parse(load('EA14')).abr.length).toBeGreaterThan(0);
    expect(trackingSchema.parse(load('EA15-ZZ')).abr.length).toBeGreaterThan(0);
    expect(ea16Schema.parse(load('EA16-ZZ')).cdp).toBe('3220');
  });
  it('uses the official configuration even when local expected codes differ', () => {
    const changed = structuredClone(conf);
    const p = changed.pl.find((p) => p.dt === '04/10/2026')!;
    p.cd = '9999';
    p.e.find((e) => e.tp === '8')!.cd = '9998';
    expect(electionConfig(changed, '04/10/2026', '1').federal.cd).toBe('9998');
  });
  it('rejects simulated data', () => {
    expect(ea20Schema.safeParse({ ...load('EA20-BR'), f: 's' }).success).toBe(false);
  });
  it('preserves official candidate order seq, not party or local vote ranking', () => {
    expect(result.candidates.map((c) => c.order)).toEqual(
      [...result.candidates.map((c) => c.order)].sort((a, b) => a - b),
    );
  });
  it('distinguishes unreleased from an officially counted zero', () => {
    expect(result.phase).toBe('unreleased');
    expect(result.metrics.votes).toBe(0);
    expect(adaptResult({ ...raw, and: 'p' }, 'k', '1', 'br', null).phase).toBe('counting');
  });
  it('retains missing data as null', () => {
    const { v: _, ...missing } = raw;
    void _;
    expect(adaptResult(missing, 'k', '1', 'br', null).metrics.votes).toBeNull();
  });
  it('rejects malformed and missing required fields', () => {
    expect(ea20Schema.safeParse({ ...load('EA20-BR'), carg: undefined }).success).toBe(false);
    expect(ea20Schema.safeParse({ ...load('EA20-BR'), s: { st: 'a' } }).success).toBe(false);
  });
  it.each(['0', '0,00', '46,82', '99.999999999', '100'])(
    'accepts official numeric precision %s',
    (v) => expect(percent.safeParse(v).success).toBe(true),
  );
  it.each(['', '-1', '101', 'NaN', '1e4'])('rejects unsafe percentage %s', (v) =>
    expect(percent.safeParse(v).success).toBe(false),
  );
  it('rejects integers outside safe precision', () =>
    expect(integer.safeParse('9007199254740993').success).toBe(false));
  it('calculates only labeled differences from current official values', () => {
    const r = structuredClone(result);
    r.phase = 'counting';
    r.candidates[0].votes = 100;
    r.candidates[1].votes = 80;
    r.candidates[0].percentageValue = 40;
    r.candidates[1].percentageValue = 32;
    expect(difference(r)).toEqual({ votes: 20, points: 8 });
    expect(difference(result)).toBeNull();
  });
  it('only uses official winner fields', () => {
    expect(result.candidates.every((c) => c.elected === false)).toBe(true);
    expect(result.mathematicallyDefined).toBeNull();
  });
  it('does not label an officially qualified second-turn candidate elected', () => {
    const r = structuredClone(raw);
    r.carg[0].agr[0].par[0].cand[0].e = 's';
    r.carg[0].agr[0].par[0].cand[0].st = '2º turno';
    r.md = 's';
    const domain = adaptResult(r, 'k', '1', 'br', null);
    expect(
      domain.candidates.find((c) => c.id === r.carg[0].agr[0].par[0].cand[0].sqcand)?.elected,
    ).toBe(false);
    expect(domain.mathematicallyDefined).toBe('second-turn');
  });
});
describe('Exterior discovery and municipality integrity', () => {
  it('identifies exterior by official descriptive configuration', () => {
    const adapter = new TSEExteriorAdapter(mu);
    expect(adapter.code).toBe('zz');
    expect(adapter.result(ea20Schema.parse(load('EA20-ZZ')), 'k').scope).toBe('zz');
    expect(adapter.countryBreakdown()).toBeNull();
  });
  it('does not assume exterior if absent and follows a changed official code', () => {
    expect(
      new TSEExteriorAdapter({ ...mu, abr: mu.abr.filter((a) => a.ds !== 'EXTERIOR') }).code,
    ).toBeNull();
    const changed = {
      ...mu,
      abr: mu.abr.map((a) => (a.ds === 'EXTERIOR' ? { ...a, cd: 'xy' } : a)),
    };
    expect(new TSEExteriorAdapter(changed).code).toBe('xy');
    expect(adaptCatalog(conf, changed, source, '04/10/2026', '1').exteriorCode).toBe('xy');
    expect(
      () =>
        new TSEExteriorAdapter({
          ...mu,
          abr: [...mu.abr, changed.abr.find((a) => a.cd === 'xy')!],
        }),
    ).toThrow();
  });
  it('supports officially configured localities, zones and aggregated sections', () => {
    const adapter = new TSEExteriorAdapter(mu);
    const sections = adapter.sections(ea16Schema.parse(load('EA16-ZZ')), source);
    expect(sections.localities[0].zones[0].code).toBe('0001');
    expect(
      sections.localities.some((m) => m.zones.some((z) => z.sections.some((s) => s.principal))),
    ).toBe(true);
    expect(adapter.result(ea20Schema.parse(load('EA20-LOCAL')), 'k', '29254').municipality).toBe(
      '29254',
    );
  });
  it('builds only documented padded filenames', () =>
    expect(resultFilename('ac', '5', '6259', '01120')).toBe('ac01120-c0005-e006259-u.jws'));
  it('constructs official directories from EA11', () =>
    expect(
      officialDirectory(conf, 'u', {
        cycle: 'ele2026',
        election: '6257',
        pleito: '3220',
        uf: 'zz',
      }),
    ).toBe('https://resultados.tse.jus.br/oficial/ele2026/6257/dados/zz'));
  it('validates municipality membership and rejects arbitrary scopes', () => {
    expect(
      resolveQuery(catalog, new URLSearchParams('scope=ac&municipality=01120')),
    ).not.toBeNull();
    expect(resolveQuery(catalog, new URLSearchParams('scope=ac&municipality=1120'))).toBeNull();
    expect(resolveQuery(catalog, new URLSearchParams('scope=ac&municipality=00000'))).toBeNull();
    expect(resolveQuery(catalog, new URLSearchParams('scope=xx'))).toBeNull();
  });
  it.each([
    'http://resultados.tse.jus.br/oficial/a',
    'https://evil.test/oficial/a',
    'https://resultados.tse.jus.br@evil.test/oficial/a',
    'https://resultados.tse.jus.br/oficial/a?url=evil',
    'https://resultados.tse.jus.br/simulado/a',
    'https://resultados.tse.jus.br/oficial/%2e%2e/a',
  ])('blocks SSRF %s', (url) => expect(() => assertOfficialUrl(url)).toThrow());
});
describe('Signature and snapshots', () => {
  it('only replaces rows whose official data changed', () => {
    const old: View = {
      resource: { ...emptyResource(), current: { data: structuredClone(result), source } },
      events: [],
      health: null,
      releaseAt: '2026-10-04T17:00:00-03:00',
    };
    const next = structuredClone(old);
    next.resource.current!.source.hash = 'new-official-revision';
    next.resource.current!.data.candidates[0].votes = 1;
    const merged = shareUnchanged(old, next);
    expect(merged.resource.current!.data.candidates[0]).not.toBe(
      old.resource.current!.data.candidates[0],
    );
    expect(merged.resource.current!.data.candidates[1]).toBe(
      old.resource.current!.data.candidates[1],
    );
    expect(merged.resource.current!.data.metrics).toBe(old.resource.current!.data.metrics);
  });
  it('verifies real official JWS for Brazil and Exterior', async () => {
    for (const name of ['EA20-BR-JWS', 'EA20-ZZ-JWS', 'EA14-JWS']) {
      const payload = await verifyOfficialJws(readFileSync(`docs/sources/${name}.jws`, 'utf8'));
      expect(JSON.parse(payload).f).toBe('o');
    }
  });
  it('rejects modified signed payload', async () => {
    const jws = readFileSync('docs/sources/EA20-BR-JWS.jws', 'utf8');
    const parts = jws.split('.');
    parts[1] = Buffer.from('{}').toString('base64url');
    await expect(verifyOfficialJws(parts.join('.'))).rejects.toThrow();
  });
  it('keeps current/previous only when official payload changes', () => {
    const a = commitSnapshot(emptyResource(), { data: result, source });
    expect(a.changed).toBe(true);
    const b = commitSnapshot(a.resource, {
      data: result,
      source: { ...source, fetchedAt: '2026-10-04T20:01:00Z' },
    });
    expect(b.changed).toBe(false);
    expect(b.resource.previous).toBeNull();
    const c = commitSnapshot(b.resource, { data: result, source: { ...source, hash: 'two' } });
    expect(c.resource.previous?.source.hash).toBe('one');
  });
  it('does not fabricate feed events for initial or unreleased data', () => {
    expect(snapshotEvents({ data: result, source }, null)).toEqual([]);
    expect(snapshotEvents({ data: result, source }, { data: result, source })).toEqual([]);
  });
  it('derives correction events including decreases', () => {
    const a = structuredClone(result),
      b = structuredClone(result);
    a.phase = b.phase = 'counting';
    a.metrics.votes = 90;
    b.metrics.votes = 100;
    expect(snapshotEvents({ data: a, source }, { data: b, source })[0].message).toContain('-10');
  });
  it('records the complete result identity for feed isolation', () => {
    const a = structuredClone(result),
      b = structuredClone(result);
    a.phase = b.phase = 'counting';
    a.key = '6259:ac:01120:5';
    a.metrics.votes = 90;
    b.metrics.votes = 100;
    expect(snapshotEvents({ data: a, source }, { data: b, source })[0].key).toBe('6259:ac:01120:5');
  });
});
