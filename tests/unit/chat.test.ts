import { afterEach, describe, expect, it, vi } from 'vitest';
import { messageSchema, profileSchema } from '../../src/features/chat/validation';
import {
  chatCookie,
  clientKey,
  readChatBody,
  requireAdmin,
  sessionCookie,
} from '../../src/server/chat/http';
import { ChatError } from '../../src/server/chat/service';
afterEach(() => vi.unstubAllEnvs());
describe('Chat input and HTTP security', () => {
  it('normalizes names and accepts Brazilian accented text', () => {
    expect(
      profileSchema.parse({ nickname: '  João  ', state: 'sp', municipality: '71072' }).nickname,
    ).toBe('João');
    expect(messageSchema.parse({ text: '  Acompanhando de São Paulo!  ' }).text).toBe(
      'Acompanhando de São Paulo!',
    );
  });
  it.each([
    '<script>alert(1)</script>',
    'https://spam.invalid',
    'www.spam.test',
    'visite spam.com',
    '\u202eenganar',
    'x'.repeat(281),
  ])('rejects links, markup, direction controls or long messages: %s', (text) => {
    expect(messageSchema.safeParse({ text }).success).toBe(false);
  });
  it('rejects incomplete identities and client-supplied extra authority', () => {
    expect(profileSchema.safeParse({ nickname: 'A', state: 'sp' }).success).toBe(false);
    expect(
      profileSchema.safeParse({
        nickname: 'Pessoa',
        state: 'sp',
        municipality: '12345',
        moderator: true,
      }).success,
    ).toBe(false);
    expect(messageSchema.safeParse({ text: 'ok', author: 'other' }).success).toBe(false);
  });
  it('requires exact origin and bounded JSON, including chunked bodies', async () => {
    vi.stubEnv('SITE_URL', 'https://elections.example');
    const request = (
      body: string,
      origin = 'https://elections.example',
      type = 'application/json',
    ) =>
      new Request('https://elections.example/api/chat/messages', {
        method: 'POST',
        body,
        headers: { origin, 'content-type': type },
      });
    await expect(readChatBody(request('{"text":"oi"}'))).resolves.toEqual({ text: 'oi' });
    await expect(readChatBody(request('{}', 'https://attacker.example'))).rejects.toMatchObject({
      status: 403,
    });
    await expect(readChatBody(request('{}', undefined, 'text/plain'))).rejects.toMatchObject({
      status: 415,
    });
    await expect(readChatBody(request('x'.repeat(5000)))).rejects.toMatchObject({ status: 413 });
    await expect(readChatBody(request('{broken'))).rejects.toMatchObject({ status: 400 });
  });
  it('keeps sessions HttpOnly, secure in production and validates cookie tokens', () => {
    vi.stubEnv('SITE_URL', 'https://elections.example');
    expect(sessionCookie('a'.repeat(64))).toContain('HttpOnly; SameSite=Strict');
    expect(sessionCookie('a'.repeat(64))).toContain('; Secure');
    expect(
      chatCookie(new Request('https://site.test', { headers: { cookie: 'ele2026-chat=bad' } })),
    ).toBeNull();
    expect(
      chatCookie(
        new Request('https://site.test', {
          headers: { cookie: 'x=1; ele2026-chat=' + 'a'.repeat(64) },
        }),
      ),
    ).toBe('a'.repeat(64));
  });
  it('requires a strong server-only moderation secret', () => {
    vi.stubEnv('CHAT_ADMIN_TOKEN', 'a'.repeat(64));
    expect(() => requireAdmin(new Request('https://site.test'))).toThrow(ChatError);
    expect(() =>
      requireAdmin(
        new Request('https://site.test', { headers: { 'x-chat-admin': 'a'.repeat(64) } }),
      ),
    ).not.toThrow();
  });
  it('ignores untrusted raw IP headers and accepts identity only behind the authenticated gateway', () => {
    vi.stubEnv('FREE_GATEWAY_TOKEN', '');
    const first = clientKey(
      new Request('https://site.test', {
        headers: { 'x-forwarded-for': '1.2.3.4', 'x-chat-client': 'a'.repeat(64) },
      }),
    );
    expect(first).toBe(
      clientKey(new Request('https://site.test', { headers: { 'x-forwarded-for': '9.9.9.9' } })),
    );
    vi.stubEnv('FREE_GATEWAY_TOKEN', 'private-gateway');
    expect(
      clientKey(new Request('https://site.test', { headers: { 'x-chat-client': 'b'.repeat(64) } })),
    ).toBe('b'.repeat(64));
  });
});
