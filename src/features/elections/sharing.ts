import type { View } from '@/lib/tse/types';
/** Keep unchanged rows stable across official revisions. */
export function shareUnchanged(old: View, next: View): View {
  const a = old.resource.current,
    b = next.resource.current;
  if (a && b) {
    if (a.source.hash === b.source.hash) next.resource.current = a;
    else {
      const prior = new Map(a.data.candidates.map((c) => [c.id, c]));
      b.data.candidates = b.data.candidates.map((c) => {
        const previous = prior.get(c.id);
        return previous && JSON.stringify(previous) === JSON.stringify(c) ? previous : c;
      });
      if (
        b.data.candidates.length === a.data.candidates.length &&
        b.data.candidates.every((c, i) => c === a.data.candidates[i])
      )
        b.data.candidates = a.data.candidates;
      if (JSON.stringify(a.data.metrics) === JSON.stringify(b.data.metrics))
        b.data.metrics = a.data.metrics;
    }
  }
  if (JSON.stringify(old.events) === JSON.stringify(next.events)) next.events = old.events;
  return next;
}
