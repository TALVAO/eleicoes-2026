import type { EA12, EA16, EA20 } from '../schemas';
import type { ExteriorSections, Provenance, Result } from '../types';
import { adaptResult } from './results';
import { officialTimestamp } from '../validation';
export class TSEExteriorAdapter {
  readonly code: string | null;
  constructor(config: EA12) {
    const matches = config.abr.filter((a) => a.ds.toLocaleUpperCase('pt-BR') === 'EXTERIOR');
    if (matches.length > 1) throw new Error('Ambiguous official Exterior identity');
    const r = matches[0];
    this.code = r?.cd ?? null;
  }
  result(raw: EA20, key: string, municipality: string | null = null): Result {
    if (!this.code || raw.cdabr !== (municipality ?? this.code))
      throw new Error('Exterior identity mismatch');
    return adaptResult(raw, key, '1', this.code, municipality);
  }
  sections(raw: EA16, source: Provenance): ExteriorSections {
    const abr = raw.abr.find((a) => a.cd === this.code);
    if (!abr || abr.ds.toLocaleUpperCase('pt-BR') !== 'EXTERIOR')
      throw new Error('Exterior sections absent');
    return {
      source,
      localities: abr.mu.map((m) => ({
        code: m.cd,
        name: m.nm,
        zones: m.zon.map((z) => ({
          code: z.cd,
          sections: z.sec.map((s) => ({
            number: s.ns,
            principal: s.nsp ?? null,
            aggregated: s.nsa ?? [],
            generatedAt: officialTimestamp(s.da, s.ha),
          })),
        })),
      })),
    };
  }
  // EA12/EA16 expose localities, not a country relation. Never infer countries.
  countryBreakdown(): null {
    return null;
  }
}
