import { z } from 'zod';

// Numeric fields are strings in the official 2026 files. Empty != zero.
export const integer = z
  .string()
  .regex(/^\d+$/)
  .refine((v) => Number.isSafeInteger(Number(v)), 'Unsafe integer');
export const percent = z
  .string()
  .regex(/^\d+(?:[,.]\d{1,9})?$/)
  .refine((v) => Number(v.replace(',', '.')) <= 100, 'Invalid percentage');
export const text = z
  .string()
  .max(1000)
  .transform((v) => v.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim());
const date = z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/);
const time = z.string().regex(/^\d{2}:\d{2}:\d{2}$/);
const dateOrEmpty = z.union([date, z.literal('')]);
const timeOrEmpty = z.union([time, z.literal('')]);
const yesNo = z.enum(['s', 'n']);
const generated = { dg: date, hg: time, idg: integer, f: z.literal('o') };
const cargo = z.object({ cd: integer, ds: text, tp: integer });
export const ea11Schema = z.object({
  ...generated,
  arq: z.array(z.object({ tp: z.string().regex(/^[a-z]+$/), dir: z.string().max(500) })),
  pl: z.array(
    z.object({
      cd: integer,
      cdpr: integer,
      c: z.string().regex(/^ele\d{4}$/),
      dt: date,
      dtlim: date,
      e: z.array(
        z.object({
          cd: integer,
          cdt2: z.union([integer, z.literal('')]).optional(),
          sqele: integer.optional(),
          nm: text,
          t: z.enum(['1', '2']),
          tp: integer,
          abr: z.array(
            z.object({
              cd: z.string().regex(/^[a-z]{2}$/),
              cp: z.array(cargo),
              mu: z.array(z.object({ cd: integer, cdi: integer })).optional(),
            }),
          ),
        }),
      ),
    }),
  ),
});
export const municipalitySchema = z.object({
  cd: z.string().regex(/^\d{5}$/),
  cdi: z.string().regex(/^\d*$/),
  nm: text,
  c: yesNo,
  z: z.array(z.string().regex(/^\d{4}$/)),
});
export const ea12Schema = z.object({
  ...generated,
  abr: z.array(
    z.object({ cd: z.string().regex(/^[a-z]{2}$/), ds: text, mu: z.array(municipalitySchema) }),
  ),
});
export const sectionsSchema = z.object({
  ts: integer.optional(),
  st: integer.optional(),
  snt: integer.optional(),
  pst: percent.optional(),
  pstn: percent.optional(),
});
export const electorateSchema = z.object({
  te: integer.optional(),
  c: integer.optional(),
  pc: percent.optional(),
  a: integer.optional(),
  pa: percent.optional(),
});
export const votesSchema = z.object({
  tv: integer.optional(),
  vv: integer.optional(),
  vvc: integer.optional(),
  vb: integer.optional(),
  tvn: integer.optional(),
  vn: integer.optional(),
  vnt: integer.optional(),
});
const candidateSchema = z.object({
  n: integer,
  sqcand: integer,
  nm: text,
  nmu: text,
  seq: integer,
  e: z.enum(['s', 'n']).optional(),
  st: text.optional(),
  vap: integer.optional(),
  pvap: percent.optional(),
  pvapn: percent.optional(),
});
export const ea20Schema = z.object({
  ...generated,
  ele: integer,
  t: z.enum(['1', '2']),
  tpabr: z.enum(['br', 'uf', 'mu', 'zona']),
  cdabr: z.string().regex(/^(?:[a-z]{2}|\d{4,5})$/),
  cdmun: integer.optional(),
  cdzon: integer.optional(),
  dt: dateOrEmpty,
  ht: timeOrEmpty,
  and: z.enum(['n', 'p', 'f']),
  dv: yesNo.optional(),
  tf: yesNo.optional(),
  md: z.enum(['e', 's', 'n']).optional(),
  esae: yesNo.optional(),
  mnae: z.array(text).optional(),
  carg: z.array(
    z.object({
      cd: integer,
      nmn: text,
      nmm: text.optional(),
      nmf: text.optional(),
      nv: integer.optional(),
      agr: z.array(
        z.object({
          par: z.array(
            z.object({ n: integer, sg: text, nm: text, cand: z.array(candidateSchema) }),
          ),
        }),
      ),
    }),
  ),
  s: sectionsSchema.optional(),
  e: electorateSchema.optional(),
  v: votesSchema.optional(),
});
export const trackingSchema = z.object({
  ...generated,
  ele: integer,
  t: z.enum(['1', '2']),
  abr: z.array(
    z.object({
      and: z.enum(['n', 'p', 'f']),
      tpabr: z.enum(['br', 'uf', 'mun', 'mu']),
      cdabr: z.string().regex(/^(?:[a-z]{2}|\d{5})$/),
      dt: dateOrEmpty,
      ht: timeOrEmpty,
      s: sectionsSchema.optional(),
      e: electorateSchema.optional(),
    }),
  ),
});
export const ea16Schema = z.object({
  ...generated,
  cdp: integer,
  abr: z.array(
    z.object({
      cd: z.string().regex(/^[a-z]{2}$/),
      ds: text,
      mu: z.array(
        z.object({
          cd: z.string().regex(/^\d{5}$/),
          nm: text,
          zon: z.array(
            z.object({
              cd: z.string().regex(/^\d{4}$/),
              sec: z.array(
                z.object({
                  ns: z.string().regex(/^\d{4}$/),
                  nsp: z
                    .string()
                    .regex(/^\d{4}$/)
                    .optional(),
                  nsa: z.array(z.string().regex(/^\d{4}$/)).optional(),
                  da: date.optional(),
                  ha: time.optional(),
                }),
              ),
            }),
          ),
        }),
      ),
    }),
  ),
});
// Auxiliary / elected files are not substituted for EA20 results.
export const ea10Schema = z.object({
  ...generated,
  ele: integer,
  cdabr: text,
  nmabr: text,
  t: z.enum(['1', '2']),
  cdcar: integer,
  nmcar: text,
  abr: z.array(
    z.object({
      dt: dateOrEmpty,
      ht: timeOrEmpty,
      tpabr: z.enum(['uf', 'mu']),
      cdabr: text,
      nmabr: text,
      tvap: integer,
      scv: yesNo,
      esae: yesNo.optional(),
      mnae: z.array(text).optional(),
      cand: z.array(
        z.object({
          n: integer,
          sqcand: integer,
          nm: text,
          nmu: text,
          sgp: text,
          com: text,
          vap: integer,
          seq: integer,
        }),
      ),
    }),
  ),
});
export type EA11 = z.infer<typeof ea11Schema>;
export type EA12 = z.infer<typeof ea12Schema>;
export type EA20 = z.infer<typeof ea20Schema>;
export type Tracking = z.infer<typeof trackingSchema>;
export type EA16 = z.infer<typeof ea16Schema>;
