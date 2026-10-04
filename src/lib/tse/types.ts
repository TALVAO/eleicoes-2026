export type SourceStatus =
  | 'ok'
  | 'unpublished'
  | 'timeout'
  | 'rate-limited'
  | 'upstream-error'
  | 'invalid-json'
  | 'schema-incompatible'
  | 'invalid-signature'
  | 'configuration-unavailable';
export interface Provenance {
  url: string;
  generatedAt: string | null;
  fetchedAt: string;
  etag: string | null;
  lastModified: string | null;
  hash: string;
  validation: 'signature-verified' | 'schema-verified';
}
export interface Candidate {
  id: string;
  name: string;
  party: string;
  number: string;
  order: number;
  votes: number | null;
  percentage: string | null;
  percentageValue: number | null;
  elected: boolean | null;
  status: string | null;
  photo: string | null;
}
export interface Metrics {
  sections: number | null;
  totalized: number | null;
  pending: number | null;
  totalizedPercent: string | null;
  totalizedPercentValue: number | null;
  votes: number | null;
  valid: number | null;
  blank: number | null;
  null: number | null;
  turnout: number | null;
  abstention: number | null;
}
export interface Result {
  key: string;
  election: string;
  scope: string;
  municipality: string | null;
  office: string;
  officeName: string;
  phase: 'unreleased' | 'counting' | 'final';
  candidates: Candidate[];
  metrics: Metrics;
  mathematicallyDefined: 'elected' | 'second-turn' | 'not-defined' | null;
  withoutElected: boolean | null;
  generatedAt: string | null;
  totalizedAt: string | null;
}
export interface Snapshot<T> {
  data: T;
  source: Provenance;
}
export interface UpdateEvent {
  id: string;
  at: string;
  scope: string;
  key: string;
  kind: 'votes' | 'totalization' | 'scope';
  message: string;
  derived: true;
}
export interface Resource<T> {
  current: Snapshot<T> | null;
  previous: Snapshot<T> | null;
  status: SourceStatus;
  lastCheckedAt: string | null;
  nextPollAt: string | null;
  failures: number;
}
export interface Municipality {
  code: string;
  name: string;
  zones: string[];
}
export interface Region {
  code: string;
  name: string;
  municipalities: Municipality[];
  exterior: boolean;
}
export interface Office {
  code: string;
  name: string;
  election: string;
  regions: string[];
}
export interface Catalog {
  date: string;
  turn: string;
  pleito: string;
  cycle: string;
  federalElection: string;
  offices: Office[];
  regions: Region[];
  exteriorCode: string | null;
  source: Provenance;
}
export interface ExteriorSections {
  localities: {
    code: string;
    name: string;
    zones: {
      code: string;
      sections: {
        number: string;
        principal: string | null;
        aggregated: string[];
        generatedAt: string | null;
      }[];
    }[];
  }[];
  source: Provenance;
}
export interface WorkerHealth {
  status: 'starting' | 'healthy' | 'degraded';
  heartbeatAt: string | null;
  lastSuccessfulFetch: string | null;
  lastTSEUpdate: string | null;
  lastSnapshotHash: string | null;
  sourceStatus: SourceStatus;
  pollingStatus: 'running' | 'backoff' | 'stopped';
  nextPollAt: string | null;
}
export interface View {
  transport?: 'sse' | 'polling';
  resource: Resource<Result>;
  events: UpdateEvent[];
  health: WorkerHealth | null;
  releaseAt: string;
  serverNow?: string;
}
