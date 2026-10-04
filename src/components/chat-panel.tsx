'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Send, Flag, ChevronDown, UserRound } from 'lucide-react';
import type { ChatLocation, ChatMessage, ChatProfile } from '@/features/chat/types';
import { usePathname } from 'next/navigation';
export function ChatEntry() {
  const pathname = usePathname();
  return pathname.startsWith('/chat/moderacao') ? null : <ChatPanel />;
}
interface SessionResponse {
  profile: ChatProfile | null;
  locations: ChatLocation[];
  blocked: boolean;
}
class ChatRequestError extends Error {}
async function jsonRequest<T>(path: string, body?: unknown): Promise<T> {
  try {
    const response = await fetch('/api/chat/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new ChatRequestError(
        typeof data.message === 'string'
          ? data.message
          : 'Não foi possível conectar. Tente novamente.',
      );
    return data as T;
  } catch (error) {
    if (error instanceof ChatRequestError) throw error;
    throw new ChatRequestError('A conexão com a conversa falhou. Tente novamente em instantes.');
  }
}
const time = (at: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(at));
export function ChatPanel() {
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [locations, setLocations] = useState<ChatLocation[]>([]);
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [nickname, setNickname] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [filterCity, setFilterCity] = useState(false);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [reported, setReported] = useState<string[]>([]);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState('abuso');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLElement>(null);
  const etag = useRef('');
  const refreshing = useRef(false);
  const lastMessage = useRef<HTMLLIElement>(null);
  const loadSession = useCallback(async () => {
    const session = await jsonRequest<SessionResponse>('session');
    setProfile(session.profile);
    setLocations(session.locations);
    setBlocked(session.blocked);
    setLoaded(true);
    return session;
  }, []);
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return;
        try {
          const saved: unknown = JSON.parse(localStorage.getItem('ele2026-chat-hidden') ?? '[]');
          if (Array.isArray(saved))
            setHidden(saved.filter((s): s is string => typeof s === 'string').slice(-100));
        } catch {}
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const dismiss = () => {
    dialog.current?.close();
    setFormError('');
  };
  async function openConversation() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpening(true);
    setError('');
    try {
      const session = await loadSession();
      setOpen(true);
      if (!session.profile) dialog.current?.showModal();
      else
        setTimeout(() => panel.current?.scrollIntoView({ behavior: 'auto', block: 'start' }), 50);
    } catch {
      setOpen(true);
      setLoaded(true);
      setError('O chat está temporariamente indisponível. Tente entrar novamente em instantes.');
    } finally {
      setOpening(false);
    }
  }
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const response = await fetch('/api/chat/messages', {
        cache: 'no-store',
        headers: etag.current ? { 'If-None-Match': etag.current } : {},
        signal: AbortSignal.timeout(12000),
      });
      if (response.status !== 304) {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message ?? 'A conversa está temporariamente indisponível.');
        setMessages(data.messages);
        etag.current = response.headers.get('etag') ?? '';
      }
      setConnected(true);
      setError('');
    } catch {
      setConnected(false);
      setError(
        navigator.onLine
          ? 'Não foi possível atualizar a conversa. Tentaremos novamente.'
          : 'Sem conexão. As mensagens abaixo são as últimas recebidas.',
      );
    } finally {
      refreshing.current = false;
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!document.hidden && navigator.onLine) await refresh();
      if (!stopped) timer = setTimeout(poll, 5000);
    };
    const reconnect = () => {
      if (!document.hidden) void refresh();
    };
    void poll();
    document.addEventListener('visibilitychange', reconnect);
    window.addEventListener('online', reconnect);
    const offline = () => {
      setConnected(false);
      setError('Sem conexão. As mensagens abaixo são as últimas recebidas.');
    };
    window.addEventListener('offline', offline);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', reconnect);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('offline', offline);
    };
  }, [open, refresh]);
  async function enter(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const result = await jsonRequest<{ profile: ChatProfile }>('session', {
        nickname,
        state,
        municipality: city,
      });
      setProfile(result.profile);
      setBlocked(false);
      dismiss();
      setOpen(true);
      setNotice('Você entrou na conversa.');
      setTimeout(() => panel.current?.scrollIntoView({ behavior: 'auto', block: 'start' }), 50);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  async function showEntry() {
    setFormError('');
    try {
      if (!locations.length) await loadSession();
      dialog.current?.showModal();
    } catch {
      setError('O cadastro está temporariamente indisponível. Tente novamente em instantes.');
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await jsonRequest('messages', { text });
      setText('');
      etag.current = '';
      await refresh();
      setNotice('Mensagem enviada.');
      setTimeout(
        () => lastMessage.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' }),
        50,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  async function report(id: string) {
    setBusy(true);
    try {
      await jsonRequest('reports', { messageId: id, reason });
      setReported((r) => [...r, id]);
      setReporting(null);
      setNotice('Denúncia registrada para revisão.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível denunciar.');
    } finally {
      setBusy(false);
    }
  }
  function hide(id: string) {
    const next = [...hidden, id].slice(-100);
    setHidden(next);
    try {
      localStorage.setItem('ele2026-chat-hidden', JSON.stringify(next));
    } catch {}
    setNotice('Participante ocultado neste navegador.');
  }
  const cities = (locations.find((r) => r.code === state)?.municipalities ?? []).filter(
    (m) =>
      !citySearch ||
      m.name
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLocaleLowerCase('pt-BR')
        .includes(citySearch.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')),
  );
  const visible = messages.filter((m) => !hidden.includes(m.author.id));
  return (
    <>
      <button
        type="button"
        className="chat-launcher"
        aria-expanded={open}
        aria-controls="visitor-chat"
        disabled={opening}
        onClick={() => void openConversation()}
      >
        <MessageCircle size={19} aria-hidden="true" /> {opening ? 'Abrindo chat…' : 'Conversa'}
      </button>
      <aside
        id="visitor-chat"
        className="chat-section"
        ref={panel}
        hidden={!open}
        aria-labelledby="chat-title"
      >
        <header className="chat-heading">
          <div>
            <h2 id="chat-title">Conversa ao vivo</h2>
            <p>Comentários dos visitantes. Sem vínculo com o TSE.</p>
          </div>
          <button
            className="chat-icon-button"
            type="button"
            aria-label="Recolher conversa"
            onClick={() => setOpen(false)}
          >
            <ChevronDown size={22} />
          </button>
        </header>
        <div className="chat-presence">
          <span className={connected ? 'chat-connected' : ''}>
            {connected ? 'Atualizando a cada 5 segundos' : 'Aguardando conexão'}
          </span>
          <span>Últimas mensagens · 24 horas</span>
        </div>
        <p className="chat-rules">
          Converse com respeito. Não publique dados pessoais, ataques ou links. Apelidos e
          localidades são informados pelos participantes.
        </p>
        <div
          className="chat-timeline"
          role="region"
          aria-label="Mensagens dos visitantes"
          tabIndex={0}
        >
          {visible.length ? (
            <ol>
              {visible.map((m, i) => (
                <li key={m.id} ref={i === visible.length - 1 ? lastMessage : undefined}>
                  <div className="chat-message-meta">
                    <strong>{m.author.nickname}</strong>
                    <span>
                      {m.author.city} · {m.author.state}
                    </span>
                    <time dateTime={m.at}>{time(m.at)}</time>
                  </div>
                  <p className="chat-message-text">{m.text}</p>
                  {m.author.id !== profile?.id && (
                    <div className="chat-message-actions">
                      <button
                        type="button"
                        disabled={reported.includes(m.id)}
                        onClick={() =>
                          profile
                            ? setReporting(reporting === m.id ? null : m.id)
                            : void showEntry()
                        }
                      >
                        <Flag size={13} aria-hidden="true" />
                        {reported.includes(m.id) ? 'Denunciado' : 'Denunciar'}
                      </button>
                      <button type="button" onClick={() => hide(m.author.id)}>
                        Ocultar participante
                      </button>
                    </div>
                  )}
                  {reporting === m.id && (
                    <div className="chat-report">
                      <label htmlFor={'reason-' + m.id}>Motivo da denúncia</label>
                      <select
                        id={'reason-' + m.id}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      >
                        <option value="abuso">Ataques ou abuso</option>
                        <option value="spam">Spam</option>
                        <option value="desinformacao">Desinformação</option>
                        <option value="outro">Outro</option>
                      </select>
                      <button
                        className="chat-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void report(m.id)}
                      >
                        Enviar denúncia
                      </button>
                      <button
                        className="chat-text-button"
                        type="button"
                        onClick={() => setReporting(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="chat-empty">
              <MessageCircle size={28} strokeWidth={1.5} aria-hidden="true" />
              <h3>A conversa começa aqui</h3>
              <p>Compartilhe sua expectativa para a apuração.</p>
            </div>
          )}
        </div>
        {error && (
          <p className="chat-error" role="alert">
            {error}
          </p>
        )}
        <p className="chat-notice" role="status">
          {notice}
        </p>
        {profile ? (
          <div className="chat-composer">
            <div className="chat-identity">
              <UserRound size={16} aria-hidden="true" />
              <span>
                <strong>{profile.nickname}</strong> · {profile.city} / {profile.state}
              </span>
              <button
                type="button"
                className="chat-text-button"
                onClick={async () => {
                  try {
                    await jsonRequest('session', { action: 'leave' });
                    setProfile(null);
                    setNotice('Você saiu da conversa.');
                  } catch {
                    setError('Não foi possível sair. Tente novamente.');
                  }
                }}
              >
                Sair
              </button>
            </div>
            {blocked ? (
              <p className="chat-error">Sua participação está bloqueada pela moderação.</p>
            ) : (
              <form onSubmit={send}>
                <label htmlFor="chat-message">Sua mensagem</label>
                <textarea
                  id="chat-message"
                  placeholder="Participe da conversa…"
                  maxLength={280}
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  required
                  aria-describedby="chat-limit"
                />
                <div className="chat-compose-bottom">
                  <span id="chat-limit">{text.length}/280 · Sem links</span>
                  <button type="submit" className="chat-button" disabled={busy || !text.trim()}>
                    <Send size={16} aria-hidden="true" />
                    {busy ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="chat-join">
            <p>Entre com seu apelido, cidade e estado para participar.</p>
            <button
              type="button"
              className="chat-button"
              disabled={!loaded}
              onClick={() => void showEntry()}
            >
              Entrar na conversa
            </button>
          </div>
        )}
        <p className="chat-privacy">
          Mensagens são públicas e permanecem por até 24 horas. Você pode denunciar ou ocultar
          participantes.
        </p>
      </aside>
      <dialog
        ref={dialog}
        className="chat-dialog"
        aria-labelledby="chat-welcome-title"
        onCancel={dismiss}
      >
        <div className="chat-dialog-top">
          <MessageCircle size={26} strokeWidth={1.5} aria-hidden="true" />
          <button className="chat-text-button" type="button" onClick={dismiss}>
            Agora não, ver resultados
          </button>
        </div>
        <h2 id="chat-welcome-title">Acompanhe. Converse. Participe.</h2>
        <p className="chat-intro">Escolha como você aparece na conversa da apuração.</p>
        <form onSubmit={enter}>
          <label htmlFor="chat-nickname">Apelido</label>
          <input
            id="chat-nickname"
            autoComplete="nickname"
            autoFocus
            minLength={2}
            maxLength={24}
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Como quer ser chamado?"
          />
          <label htmlFor="chat-state">Estado ou Exterior</label>
          <select
            id="chat-state"
            required
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setCity('');
              setCitySearch('');
              setFilterCity(false);
            }}
          >
            <option value="">Selecione</option>
            {locations.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
          <div className="chat-city-label">
            <label htmlFor="chat-city">Cidade ou localidade</label>
            <button
              type="button"
              className="chat-text-button"
              disabled={!state}
              aria-expanded={filterCity}
              aria-controls="chat-city-filter"
              onClick={() => {
                setFilterCity((v) => !v);
                setCitySearch('');
              }}
            >
              Filtrar cidades
            </button>
          </div>
          {filterCity && (
            <div id="chat-city-filter">
              <label htmlFor="chat-city-search">Buscar cidade ou localidade</label>
              <input
                id="chat-city-search"
                type="search"
                disabled={!state}
                value={citySearch}
                onChange={(e) => {
                  setCitySearch(e.target.value);
                  setCity('');
                }}
                placeholder="Digite para filtrar a lista"
              />
            </div>
          )}
          <select
            id="chat-city"
            required
            value={city}
            disabled={!state}
            onChange={(e) => {
              setCity(e.target.value);
              setFilterCity(false);
              setCitySearch('');
            }}
          >
            <option value="">
              {!state
                ? 'Selecione o estado primeiro'
                : cities.length
                  ? 'Selecione sua cidade'
                  : 'Nenhuma cidade encontrada'}
            </option>
            {cities.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="chat-form-note">
            Apelido e cidade ficam públicos nas mensagens. Não use seu nome completo nem informe
            dados pessoais.
          </p>
          {formError && (
            <p className="chat-error" role="alert">
              {formError}
            </p>
          )}
          <button
            className="chat-button chat-submit"
            type="submit"
            disabled={busy || !locations.length}
          >
            {busy ? 'Entrando…' : 'Entrar na conversa'}
          </button>
          <button className="chat-text-button chat-later" type="button" onClick={dismiss}>
            Agora não, ver os resultados
          </button>
        </form>
      </dialog>
    </>
  );
}
