'use client';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import type { ChatMessage } from '@/features/chat/types';
type Item = ChatMessage & { reports: number; reasons: string[] };
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function ChatModeration() {
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const [token, setToken] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function request(body?: unknown) {
    let response: Response;
    try {
      response = await fetch('/api/chat/moderation', {
        method: body ? 'POST' : 'GET',
        cache: 'no-store',
        headers: { 'x-chat-admin': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new Error('Conexão com a moderação indisponível. Tente novamente.');
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Não foi possível ler a resposta. Tente novamente.');
    }
    if (!response.ok) throw new Error(data.message ?? 'Não foi possível acessar a moderação.');
    return data;
  }
  async function refresh(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await request();
      setItems(data.messages);
      setLoggedIn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  async function moderate(messageId: string, action: string) {
    setBusy(true);
    setError('');
    try {
      await request({ messageId, action });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="chat-admin">
      <h1>Moderação da conversa</h1>
      <p>
        Acesso reservado ao responsável pelo site. A chave fica somente na memória desta página.
      </p>
      {!loggedIn ? (
        <form onSubmit={refresh}>
          <label htmlFor="chat-admin-token">Chave de moderação</label>
          <input
            type="password"
            disabled={!ready}
            id="chat-admin-token"
            autoComplete="off"
            required
            minLength={32}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button className="chat-button" disabled={!ready || busy} type="submit">
            {busy ? 'Entrando…' : 'Acessar'}
          </button>
        </form>
      ) : (
        <>
          <div className="chat-admin-controls">
            <button className="chat-button" disabled={busy} onClick={() => void refresh()}>
              Atualizar mensagens
            </button>
            <button
              className="chat-text-button"
              onClick={() => {
                setLoggedIn(false);
                setToken('');
                setItems([]);
              }}
            >
              Sair da moderação
            </button>
          </div>
          <p>
            As denúncias são revisadas manualmente. Bloquear impede novos envios pelo participante e
            pela conexão por 7 dias; uma conexão pode ser compartilhada.
          </p>
          <ol className="chat-admin-list">
            {items.map((m) => (
              <li key={m.id}>
                <div className="chat-message-meta">
                  <strong>{m.author.nickname}</strong>
                  <span>
                    {m.author.city} · {m.author.state}
                  </span>
                  <time dateTime={m.at}>
                    {new Date(m.at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </time>
                </div>
                <p className="chat-message-text">{m.text}</p>
                <p>
                  {m.reports
                    ? `${m.reports} denúncia(s): ${m.reasons.join(', ')}`
                    : 'Sem denúncias'}
                </p>
                <div className="chat-admin-controls">
                  <button
                    className="chat-button"
                    disabled={busy}
                    onClick={() => void moderate(m.id, 'remove')}
                  >
                    Remover mensagem
                  </button>
                  <button
                    className="chat-button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          'Remover esta mensagem e bloquear o participante e sua conexão por 7 dias?',
                        )
                      )
                        void moderate(m.id, 'block');
                    }}
                  >
                    Bloquear participante
                  </button>
                  {m.reports > 0 && (
                    <button
                      className="chat-text-button"
                      disabled={busy}
                      onClick={() => void moderate(m.id, 'dismiss')}
                    >
                      Dispensar denúncias
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {!items.length && <p>Nenhuma mensagem disponível.</p>}
        </>
      )}
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
