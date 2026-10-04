import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { RedisChatRepository } from '../../src/server/chat/repository';
import { ChatService, hashToken } from '../../src/server/chat/service';
const url = process.env.CHAT_TEST_REDIS_URL;
describe.skipIf(!url)('Real Redis chat: atomic publication, sessions and moderation', () => {
  let redis: Redis, repository: RedisChatRepository, service: ChatService;
  const prefix = 'ele2026:chat-test:' + randomUUID() + ':';
  const locations = [
    { code: 'ac', name: 'ACRE', municipalities: [{ code: '01392', name: 'RIO BRANCO' }] },
  ];
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      !['/14', '/15'].includes(target.pathname)
    )
      throw new Error('Only isolated local validation DBs allowed');
    redis = new Redis(url!, { lazyConnect: true, enableOfflineQueue: false });
    await redis.connect();
    repository = new RedisChatRepository(redis, prefix);
    service = new ChatService(repository);
  });
  afterAll(async () => {
    if (!redis) return;
    const keys = await redis.keys(prefix + '*');
    if (keys.length) await redis.unlink(...keys);
    redis.disconnect();
  });
  it('stores only hashed session tokens and validates the municipality against official catalog', async () => {
    await expect(
      service.join(
        { nickname: 'Pessoa', state: 'ac', municipality: '99999' },
        'client-a',
        locations,
      ),
    ).rejects.toMatchObject({ status: 400 });
    const joined = await service.join(
      { nickname: 'Pessoa', state: 'ac', municipality: '01392' },
      'client-a',
      locations,
    );
    expect((await service.identify(joined.token))?.profile.city).toBe('RIO BRANCO');
    expect(await redis.get(prefix + 'session:' + joined.token)).toBeNull();
    expect(await redis.ttl(prefix + 'session:' + hashToken(joined.token))).toBeGreaterThan(86390);
  });
  it('allows exactly one simultaneous send and rejects duplicate/cooldown bypass', async () => {
    const joined = await service.join(
      { nickname: 'Concorrente', state: 'ac', municipality: '01392' },
      'client-b',
      locations,
    );
    const sends = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        service.send({ text: 'Mensagem de teste isolado' }, joined.token, 'client-b'),
      ),
    );
    expect(sends.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await repository.messages()).filter((m) => m.author.id === joined.profile.id),
    ).toHaveLength(1);
    await redis.del(prefix + 'cooldown:' + joined.profile.id);
    await expect(
      service.send({ text: 'Mensagem de teste isolado' }, joined.token, 'client-b'),
    ).rejects.toMatchObject({ status: 429 });
  });
  it('rejects unauthenticated sends and expires missing sessions without fabricating identity', async () => {
    await expect(service.send({ text: 'Oi' }, null, 'anonymous')).rejects.toMatchObject({
      status: 401,
    });
    await expect(service.send({ text: 'Oi' }, 'f'.repeat(64), 'anonymous')).rejects.toMatchObject({
      status: 401,
    });
  });
  it('deduplicates reports, dismisses them, removes messages and blocks renewed sessions', async () => {
    const joined = await service.join(
      { nickname: 'Moderado', state: 'ac', municipality: '01392' },
      'client-c',
      locations,
    );
    const message = await service.send(
      { text: 'Teste de moderação isolado' },
      joined.token,
      'client-c',
    );
    expect(await repository.report(message.id, 'reporter', 'abuso')).toBe(true);
    expect(await repository.report(message.id, 'reporter', 'spam')).toBe(false);
    expect((await repository.moderation()).find((m) => m.id === message.id)?.reports).toBe(1);
    await repository.moderate(message.id, 'dismiss');
    expect((await repository.moderation()).find((m) => m.id === message.id)?.reports).toBe(0);
    await repository.moderate(message.id, 'block');
    expect((await repository.messages()).some((m) => m.id === message.id)).toBe(false);
    await expect(
      service.send({ text: 'Nova mensagem' }, joined.token, 'client-c'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.join(
        { nickname: 'Novo apelido', state: 'ac', municipality: '01392' },
        'client-c',
        locations,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('bounds rate counters atomically under concurrent requests', async () => {
    const rates = await Promise.all(
      Array.from({ length: 20 }, () => repository.rate('concurrent-test', 5, 60)),
    );
    expect(rates.filter(Boolean)).toHaveLength(5);
    expect(await redis.ttl(prefix + 'rate:concurrent-test')).toBeGreaterThan(0);
  });
  it('omits expired content even when an index entry remains', async () => {
    await redis.zadd(prefix + 'messages', Date.now(), 'expired-entry');
    expect((await repository.messages()).some((m) => m.id === 'expired-entry')).toBe(false);
  });
});
