import type { z } from 'zod';
import { createHash } from 'node:crypto';
import { TSEClient, TSEError } from '@/lib/tse/client';
import {
  ea11Schema,
  ea12Schema,
  ea20Schema,
  trackingSchema,
  ea16Schema,
  type EA11,
  type EA12,
  type EA16,
} from '@/lib/tse/schemas';
import { CONFIG_URL, officialDirectory, padded, resultFilename } from '@/lib/tse/urls';
import { electionConfig, adaptCatalog } from '@/lib/tse/adapters/elections';
import { adaptResult } from '@/lib/tse/adapters/results';
import { TSEExteriorAdapter } from '@/lib/tse/adapters/exterior';
import { officialTimestamp } from '@/lib/tse/validation';
import { emptyResource, commitSnapshot, snapshotEvents } from '@/lib/tse/cache';
import { pollDelay } from '@/lib/tse/polling';
import type {
  Catalog,
  Resource,
  Result,
  UpdateEvent,
  WorkerHealth,
  Snapshot,
  Provenance,
} from '@/lib/tse/types';
import { resolveQuery, type Query } from './query';
import type { Store } from './store';
export const log = (event: string, details: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ time: new Date().toISOString(), event, ...details }));
interface Job {
  key: string;
  url: string;
  due: number;
  unchanged: number;
  failures: number;
  minDelay: number;
  run: () => Promise<void | number>;
}
export class Ingestion {
  private config: EA11 | null = null;
  private municipalities: EA12 | null = null;
  private catalog: Catalog | null = null;
  private jobs = new Map<string, Job>();
  private sourceMeta = new Map<string, Provenance>();
  private queries = new Map<string, Query>();
  private health: WorkerHealth = {
    status: 'starting',
    heartbeatAt: null,
    lastSuccessfulFetch: null,
    lastTSEUpdate: null,
    lastSnapshotHash: null,
    sourceStatus: 'configuration-unavailable',
    pollingStatus: 'running',
    nextPollAt: null,
  };
  private configurationDue = 0;
  private configurationFailed = false;
  private restored = false;
  private blockedUntil = 0;
  private async rateLimitHeartbeat() {
    this.health.status = 'degraded';
    this.health.sourceStatus = 'rate-limited';
    this.health.pollingStatus = 'backoff';
    this.health.nextPollAt = new Date(this.blockedUntil).toISOString();
    await this.pulse();
  }
  private async rememberRateLimit(e: unknown) {
    if (e instanceof TSEError && e.status === 'rate-limited') {
      this.blockedUntil = Math.max(Date.now() + 600_000, this.client.rateLimitUntil);
      await this.store.put('tse:block-until', this.blockedUntil, this.token);
    }
  }
  constructor(
    private store: Store,
    private token: string,
    private client: TSEClient = new TSEClient(),
  ) {}
  async pulse() {
    this.health.heartbeatAt = new Date().toISOString();
    await this.store.put('health', this.health, this.token);
  }
  private dir(type: string, election: string, scope: string) {
    if (!this.config || !this.catalog) throw new Error('Configuration absent');
    return officialDirectory(this.config, type, {
      cycle: this.catalog.cycle,
      election,
      pleito: this.catalog.pleito,
      uf: scope,
    });
  }
  private async fetch<T extends { dg: string; hg: string }>(
    url: string,
    schema: z.ZodType<T>,
  ): Promise<Snapshot<T> | null> {
    const previous =
      this.sourceMeta.get(url) ?? (await this.store.get<Snapshot<T>>('raw:' + url))?.source;
    const got = await this.client.get(url, schema, previous);
    this.health.lastSuccessfulFetch = new Date().toISOString();
    if (got.unchanged) {
      const cached = await this.store.get<Snapshot<T>>('raw:' + url);
      if (!cached) throw new TSEError('upstream-error');
      return cached;
    }
    got.source.generatedAt = officialTimestamp(got.data.dg, got.data.hg);
    this.sourceMeta.set(url, got.source);
    const snapshot = { data: got.data, source: got.source };
    await this.store.put('raw:' + url, snapshot, this.token);
    return snapshot;
  }
  async configure() {
    const conf = await this.fetch(CONFIG_URL, ea11Schema);
    if (!conf) throw new Error('Configuration missing');
    const date = process.env.TSE_ELECTION_DATE ?? '04/10/2026',
      turn = process.env.TSE_TURN ?? '1';
    const { pl, federal } = electionConfig(conf.data, date, turn);
    const muUrl =
      officialDirectory(conf.data, 'cm', {
        cycle: pl.c,
        election: federal.cd,
        pleito: pl.cd,
        uf: 'br',
      }) + `/mun-e${padded(federal.cd, 6)}-cm.json`;
    const municipalities = await this.fetch(muUrl, ea12Schema);
    if (!municipalities) throw new Error('Municipalities missing');
    const catalog = adaptCatalog(conf.data, municipalities.data, conf.source, date, turn);
    // Region membership for each election is authoritative EA12, not presumed.
    for (const e of pl.e.filter((e) => e.t === turn && e.cd !== federal.cd)) {
      const u =
        officialDirectory(conf.data, 'cm', {
          cycle: pl.c,
          election: e.cd,
          pleito: pl.cd,
          uf: 'br',
        }) + `/mun-e${padded(e.cd, 6)}-cm.json`;
      const m = await this.fetch(u, ea12Schema);
      if (!m) continue;
      for (const o of catalog.offices.filter((o) => o.election === e.cd))
        o.regions = o.regions.filter((r) => m.data.abr.some((a) => a.cd === r));
    }
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([conf.data, municipalities.data, catalog.offices]))
      .digest('hex');
    const changed = fingerprint !== (await this.store.get<string>('catalog:fingerprint'));
    this.config = conf.data;
    this.municipalities = municipalities.data;
    this.catalog = catalog;
    if (changed) {
      this.jobs.clear();
      this.queries.clear();
      await this.store.put('catalog', catalog, this.token);
      await this.store.put('catalog:fingerprint', fingerprint, this.token);
      log('configuration.validated', { pleito: pl.cd, federal: federal.cd, cycle: pl.c });
    }
    this.configurationDue = Date.now() + 300_000;
    this.configurationFailed = false;
    this.addQuery({
      scope: 'br',
      office: '1',
      municipality: null,
      key: `${federal.cd}:br:-:1`,
      election: federal.cd,
    });
    for (const r of catalog.regions)
      this.addQuery({
        scope: r.code,
        office: '1',
        municipality: null,
        key: `${federal.cd}:${r.code}:-:1`,
        election: federal.cd,
      });
    const elections = [...new Set(catalog.offices.map((o) => o.election))];
    for (const election of elections) this.addTracking(election, 'br');
    if (catalog.exteriorCode) this.addSections(catalog.exteriorCode);
  }
  private add(job: Job) {
    if (!this.jobs.has(job.key)) this.jobs.set(job.key, job);
  }
  private addSections(scope: string) {
    const url =
      this.dir('cs', this.catalog!.federalElection, scope) +
      `/${scope}-p${padded(this.catalog!.pleito, 6)}-cs.json`;
    this.add({
      key: 'sections:' + scope,
      url,
      due: 0,
      unchanged: 0,
      failures: 0,
      minDelay: 3600_000,
      run: async () => {
        const raw = await this.fetch<EA16>(url, ea16Schema);
        if (!raw) return;
        if (raw.data.cdp !== this.catalog!.pleito) throw new TSEError('schema-incompatible');
        const adapter = new TSEExteriorAdapter(this.municipalities!);
        await this.store.put(
          'exterior:sections',
          adapter.sections(raw.data, raw.source),
          this.token,
        );
      },
    });
  }
  private addTracking(election: string, scope: string) {
    const url = this.dir('ab', election, scope) + `/${scope}-e${padded(election, 6)}-ab.jws`;
    this.add({
      key: `tracking:${election}:${scope}`,
      url,
      due: 0,
      unchanged: 0,
      failures: 0,
      minDelay: scope === 'br' ? 2000 : 10_000,
      run: async () => {
        const raw = await this.fetch(url, trackingSchema);
        if (!raw) return;
        if (raw.data.ele !== election || raw.data.t !== this.catalog!.turn)
          throw new TSEError('schema-incompatible');
        const key = `tracking:${election}:${scope}`;
        const old = await this.store.get<Snapshot<z.infer<typeof trackingSchema>>>(key);
        await this.store.put(key, raw, this.token);
        for (const a of raw.data.abr) {
          const previous = old?.data.abr.find((b) => b.cdabr === a.cdabr);
          if (!previous || a.dt !== previous.dt || a.ht !== previous.ht || a.and !== previous.and) {
            for (const q of this.queries.values())
              if (
                q.election === election &&
                (scope === 'br'
                  ? q.scope === a.cdabr
                  : q.scope === scope && q.municipality === a.cdabr)
              ) {
                const job = this.jobs.get(q.key);
                if (job && job.failures === 0) job.due = Math.min(job.due, Date.now());
              }
          }
        }
      },
    });
  }
  private addQuery(q: Query) {
    if (!this.catalog || !this.config) return;
    this.queries.set(q.key, q);
    const url =
      this.dir('u', q.election, q.scope) +
      '/' +
      resultFilename(q.scope, q.office, q.election, q.municipality ?? undefined);
    this.add({
      key: q.key,
      url,
      due: 0,
      unchanged: 0,
      failures: 0,
      minDelay: q.scope === 'br' || q.scope === this.catalog.exteriorCode ? 2000 : 60_000,
      run: async () => {
        const existing =
          (await this.store.get<Resource<Result>>('result:' + q.key)) ?? emptyResource<Result>();
        const deferred = Date.parse(existing.nextPollAt ?? '');
        if (existing.failures > 0 && deferred > Date.now()) {
          const job = this.jobs.get(q.key);
          if (job) job.failures = existing.failures;
          return deferred;
        }
        try {
          const raw = await this.fetch(url, ea20Schema);
          if (!raw) return;
          if (
            raw.data.ele !== q.election ||
            raw.data.t !== this.catalog!.turn ||
            raw.data.cdabr !== (q.municipality ?? q.scope) ||
            raw.data.tpabr !== (q.municipality ? 'mu' : q.scope === 'br' ? 'br' : 'uf')
          )
            throw new TSEError('schema-incompatible');
          const photo = (id: string) => `/api/photo?election=${q.election}&id=${id}`;
          const data = adaptResult(
            raw.data,
            q.key,
            q.office,
            q.scope,
            q.municipality,
            this.config!.arq.some((a) => a.tp === 'ft') ? photo : undefined,
          );
          if (this.config!.arq.some((a) => a.tp === 'ft'))
            for (const candidate of data.candidates) {
              const key = `photo:${q.election}:${candidate.id}`,
                url =
                  this.dir('ft', q.election, q.office === '1' ? 'br' : q.scope) +
                  `/${candidate.id}.jpeg`;
              const cached = await this.store.get<string>(key);
              if (!cached)
                this.add({
                  key,
                  url,
                  due: Date.now() + 60_000,
                  unchanged: 0,
                  failures: 0,
                  minDelay: 86400_000,
                  run: async () => {
                    const bytes = await this.client.photo(url);
                    await this.store.put(key, bytes, this.token);
                  },
                });
            }
          const commit = commitSnapshot(existing, { data, source: raw.source });
          await this.store.put('result:' + q.key, commit.resource, this.token);
          if (q.municipality && q.office === '1' && q.scope !== this.catalog!.exteriorCode) {
            const observed = (await this.store.get<string[]>('municipalities:observed')) ?? [];
            if (!observed.includes(q.key))
              await this.store.put('municipalities:observed', [...observed, q.key], this.token);
          }
          if (commit.changed) {
            const events = snapshotEvents(commit.resource.current!, commit.resource.previous);
            if (events.length) {
              const prior = (await this.store.get<UpdateEvent[]>('events')) ?? [];
              await this.store.put('events', [...events, ...prior].slice(0, 50), this.token);
            }
            this.health.lastTSEUpdate = data.generatedAt;
            this.health.lastSnapshotHash = raw.source.hash;
            log('snapshot.committed', { key: q.key, hash: raw.source.hash });
          }
        } catch (e) {
          const status = e instanceof TSEError ? e.status : 'schema-incompatible';
          await this.store.put(
            'result:' + q.key,
            {
              ...existing,
              status,
              lastCheckedAt: new Date().toISOString(),
              failures: existing.failures + 1,
            },
            this.token,
          );
          throw e;
        }
      },
    });
    if (q.municipality) this.addTracking(q.election, q.scope);
  }
  async tick() {
    if (!this.restored) {
      this.blockedUntil = (await this.store.get<number>('tse:block-until')) ?? 0;
      const previousHealth = await this.store.get<WorkerHealth>('health');
      if (previousHealth) this.health = { ...previousHealth, status: 'starting' };
      this.restored = true;
    }
    if (this.blockedUntil > Date.now()) {
      await this.rateLimitHeartbeat();
      return;
    }
    if (this.configurationDue <= Date.now()) {
      try {
        await this.configure();
      } catch (e) {
        await this.rememberRateLimit(e);
        this.configurationFailed = true;
        this.health.sourceStatus = e instanceof TSEError ? e.status : 'configuration-unavailable';
        this.health.status = 'degraded';
        this.configurationDue = Date.now() + 300_000;
        log('configuration.error', { status: this.health.sourceStatus });
      }
    }
    if (this.blockedUntil > Date.now()) {
      await this.rateLimitHeartbeat();
      return;
    }
    if (this.catalog) {
      const demands = await this.store.demands();
      const demanded = new Set(demands);
      for (const demand of demands) {
        const [election, scope, municipality, office] = demand.split(':');
        const q = resolveQuery(
          this.catalog,
          new URLSearchParams({ scope, office, ...(municipality !== '-' ? { municipality } : {}) }),
        );
        if (q && q.election === election) this.addQuery(q);
      }
      for (const q of this.queries.values())
        if ((q.municipality || q.office !== '1') && !demanded.has(q.key)) {
          this.jobs.delete(q.key);
          this.queries.delete(q.key);
        }
    }
    const due = [...this.jobs.values()]
      .filter((j) => j.due <= Date.now())
      .sort(
        (a, b) =>
          Number(a.key.startsWith('photo:')) - Number(b.key.startsWith('photo:')) || a.due - b.due,
      )[0];
    if (due) {
      const previousHash = this.sourceMeta.get(due.url)?.hash;
      try {
        const deferred = await due.run();
        if (typeof deferred === 'number') due.due = deferred;
        else {
          const same = this.sourceMeta.get(due.url)?.hash === previousHash;
          due.unchanged = same ? due.unchanged + 1 : 0;
          due.failures = 0;
          let delay = Math.max(due.minDelay, pollDelay('ok', due.unchanged, 0));
          if (
            this.catalog &&
            (due.key === `${this.catalog.federalElection}:br:-:1` ||
              due.key === `tracking:${this.catalog.federalElection}:br`)
          ) {
            const national = await this.store.get<Resource<Result>>(
              `result:${this.catalog.federalElection}:br:-:1`,
            );
            if (national?.current?.data.phase === 'counting') delay = Math.min(delay, 5000);
          }
          due.due = Date.now() + delay;
        }
      } catch (e) {
        await this.rememberRateLimit(e);
        const status = e instanceof TSEError ? e.status : 'schema-incompatible';
        due.failures++;
        due.due =
          Date.now() +
          Math.max(
            due.minDelay,
            pollDelay(status, 0, due.failures),
            e instanceof TSEError ? (e.retryAfterMs ?? 0) : 0,
          );
        log('source.error', {
          key: due.key,
          status,
          httpStatus: e instanceof TSEError ? e.httpStatus : null,
          retryAt: new Date(due.due).toISOString(),
        });
      }
      const q = this.queries.get(due.key);
      if (q) {
        const r = await this.store.get<Resource<Result>>('result:' + q.key);
        if (r)
          await this.store.put(
            'result:' + q.key,
            { ...r, nextPollAt: new Date(due.due).toISOString() },
            this.token,
          );
      }
    }
    if (this.blockedUntil > Date.now()) {
      await this.rateLimitHeartbeat();
      return;
    }
    const critical = this.catalog
      ? await this.store.get<Resource<Result>>(`result:${this.catalog.federalElection}:br:-:1`)
      : null;
    if (!this.configurationFailed)
      this.health.sourceStatus = critical?.status ?? this.health.sourceStatus;
    this.health.status =
      !this.configurationFailed && critical?.status === 'ok' ? 'healthy' : 'degraded';
    this.health.lastTSEUpdate = critical?.current?.source.generatedAt ?? this.health.lastTSEUpdate;
    this.health.lastSnapshotHash = critical?.current?.source.hash ?? this.health.lastSnapshotHash;
    this.health.pollingStatus = critical && critical.failures > 0 ? 'backoff' : 'running';
    this.health.nextPollAt = new Date(
      Math.min(this.configurationDue, ...[...this.jobs.values()].map((j) => j.due)),
    ).toISOString();
    await this.pulse();
  }
}
