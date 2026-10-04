import type { Resource, Snapshot, UpdateEvent, Result } from './types';
export function emptyResource<T>(): Resource<T> {
  return {
    current: null,
    previous: null,
    status: 'unpublished',
    lastCheckedAt: null,
    nextPollAt: null,
    failures: 0,
  };
}
export function commitSnapshot<T>(
  resource: Resource<T>,
  snapshot: Snapshot<T>,
): { resource: Resource<T>; changed: boolean } {
  const changed = resource.current?.source.hash !== snapshot.source.hash;
  return {
    changed,
    resource: {
      ...resource,
      current: changed ? snapshot : resource.current,
      previous: changed ? resource.current : resource.previous,
      status: 'ok',
      lastCheckedAt: snapshot.source.fetchedAt,
      failures: 0,
    },
  };
}
export function snapshotEvents(
  current: Snapshot<Result>,
  previous: Snapshot<Result> | null,
): UpdateEvent[] {
  if (!previous || current.data.phase === 'unreleased' || previous.data.phase === 'unreleased')
    return [];
  const a = current.data.metrics,
    b = previous.data.metrics;
  const events: UpdateEvent[] = [];
  const base = {
    at: current.source.fetchedAt,
    scope: current.data.scope,
    key: current.data.key,
    derived: true as const,
  };
  if (a.votes !== null && b.votes !== null && a.votes !== b.votes) {
    const d = a.votes - b.votes;
    events.push({
      ...base,
      id: current.source.hash + '-v',
      kind: 'votes',
      message: `${d > 0 ? '+' : ''}${d.toLocaleString('pt-BR')} votos computados desde a atualização anterior`,
    });
  }
  if (
    a.totalizedPercent !== null &&
    b.totalizedPercent !== null &&
    a.totalizedPercent !== b.totalizedPercent
  )
    events.push({
      ...base,
      id: current.source.hash + '-s',
      kind: 'totalization',
      message: `Totalização passou de ${b.totalizedPercent}% para ${a.totalizedPercent}%`,
    });
  if (!events.length)
    events.push({
      ...base,
      id: current.source.hash + '-u',
      kind: 'scope',
      message: `${current.data.scope.toUpperCase()} recebeu nova atualização oficial`,
    });
  return events;
}
