'use client';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { View } from '@/lib/tse/types';
import { shareUnchanged } from './sharing';
interface State {
  view: View;
  offline: boolean;
  connection: 'connecting' | 'connected' | 'degraded';
  now: number;
}
class LiveStore {
  private listeners = new Set<() => void>();
  private sse: EventSource | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private fallback: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController | null = null;
  private active = false;
  state: State;
  constructor(
    private query: string,
    initial: View,
    private scopeLabel?: string,
  ) {
    this.state = { view: initial, offline: false, connection: 'connecting', now: 0 };
  }
  get = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
  private receive(view: View) {
    view = shareUnchanged(this.state.view, view);
    this.emit({ view, connection: 'connected', offline: !navigator.onLine, now: Date.now() });
    if (view.resource.current)
      try {
        localStorage.setItem('ele2026:' + this.query, JSON.stringify({ version: 1, view }));
      } catch {}
  }
  private async poll() {
    if (!this.active || document.hidden || !navigator.onLine) return;
    if (this.fallback) {
      clearTimeout(this.fallback);
      this.fallback = null;
    }
    this.controller?.abort();
    this.controller = new AbortController();
    const timeout = setTimeout(() => this.controller?.abort(), 8000);
    try {
      const response = await fetch('/api/results?' + this.query, {
        cache: 'no-store',
        signal: this.controller.signal,
      });
      if (!response.ok) throw new Error('Unavailable');
      this.receive((await response.json()) as View);
    } catch {
      this.emit({ connection: 'degraded' });
    } finally {
      clearTimeout(timeout);
    }
    if (this.active && this.sse?.readyState !== EventSource.OPEN)
      this.fallback = setTimeout(
        () => {
          this.fallback = null;
          void this.poll();
        },
        this.state.connection === 'degraded' ? 15_000 : 5000 + Math.floor(Math.random() * 500),
      );
  }
  private network = () => {
    const offline = !navigator.onLine;
    this.emit({ offline });
    if (offline) {
      try {
        const cached = JSON.parse(localStorage.getItem('ele2026:' + this.query) ?? 'null');
        if (cached?.version === 1 && cached.view?.resource?.current)
          this.emit({ view: cached.view as View });
      } catch {}
    } else {
      void this.poll();
    }
  };
  start() {
    this.active = true;
    if (this.scopeLabel)
      try {
        localStorage.setItem(
          'ele2026:primary:' + location.pathname,
          JSON.stringify({ version: 1, query: this.query, label: this.scopeLabel }),
        );
      } catch {}
    this.network();
    window.addEventListener('online', this.network);
    window.addEventListener('offline', this.network);
    document.addEventListener('visibilitychange', this.visibility);
    if (this.state.view.transport !== 'polling') {
      this.sse = new EventSource('/api/events?' + this.query);
      this.sse.addEventListener('snapshot', (event) => {
        try {
          this.receive(JSON.parse((event as MessageEvent).data));
        } catch {
          this.emit({ connection: 'degraded' });
        }
      });
      this.sse.addEventListener('connection', () => this.emit({ connection: 'degraded' }));
      this.sse.addEventListener('heartbeat', (event) => {
        try {
          const heartbeat = JSON.parse((event as MessageEvent).data) as Pick<
            View,
            'health' | 'serverNow'
          >;
          this.emit({
            view: { ...this.state.view, health: heartbeat.health, serverNow: heartbeat.serverNow },
            connection: 'connected',
            now: Date.now(),
          });
        } catch {
          this.emit({ connection: 'degraded' });
        }
      });
      this.sse.onerror = () => {
        this.emit({ connection: 'degraded' });
        if (!this.fallback)
          this.fallback = setTimeout(() => {
            this.fallback = null;
            void this.poll();
          }, 15_000);
      };
      this.sse.onopen = () => {
        this.emit({ connection: 'connected' });
        if (this.fallback) {
          clearTimeout(this.fallback);
          this.fallback = null;
        }
      };
    }
    this.timer = setInterval(() => this.emit({ now: Date.now() }), 10_000);
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => {
      this.active = false;
      this.sse?.close();
      this.controller?.abort();
      if (this.timer) clearInterval(this.timer);
      if (this.fallback) clearTimeout(this.fallback);
      window.removeEventListener('online', this.network);
      window.removeEventListener('offline', this.network);
      document.removeEventListener('visibilitychange', this.visibility);
    };
  }
  private visibility = () => {
    if (!document.hidden) void this.poll();
  };
}
export function useLive(query: string, initial: View, scopeLabel?: string) {
  const store = useMemo(
    () => new LiveStore(query, initial, scopeLabel),
    [query, initial, scopeLabel],
  );
  useEffect(() => store.start(), [store]);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
