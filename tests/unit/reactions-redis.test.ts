import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { ReactionRepository } from '../../src/server/reactions';
const url = process.env.CHAT_TEST_REDIS_URL;
describe.skipIf(!url)('Atomic community reactions in isolated Redis', () => {
  let redis: Redis, repository: ReactionRepository;
  const prefix = 'ele2026:reaction-test:' + randomUUID() + ':';
  beforeAll(async () => {
    const target = new URL(url!);
    if (
      !['localhost', '127.0.0.1'].includes(target.hostname) ||
      !['/14', '/15'].includes(target.pathname)
    )
      throw new Error('Only isolated local DBs');
    redis = new Redis(url!, { lazyConnect: true, enableOfflineQueue: false });
    await redis.connect();
    repository = new ReactionRepository(redis, prefix);
  });
  afterAll(async () => {
    if (!redis) return;
    const keys = await redis.keys(prefix + '*');
    if (keys.length) await redis.unlink(...keys);
    redis.disconnect();
  });
  it('parallel repeats count once; switching and removing never inflate or go negative', async () => {
    await Promise.all(
      Array.from({ length: 30 }, () => repository.change('test', 'candidate', 'person', 'like')),
    );
    expect((await repository.read('test', ['candidate'], 'person')).candidate).toEqual({
      like: 1,
      dislike: 0,
      selected: 'like',
    });
    await repository.change('test', 'candidate', 'person', 'dislike');
    expect((await repository.read('test', ['candidate'], 'person')).candidate).toEqual({
      like: 0,
      dislike: 1,
      selected: 'dislike',
    });
    await Promise.all(
      Array.from({ length: 10 }, () => repository.change('test', 'candidate', 'person', null)),
    );
    expect((await repository.read('test', ['candidate'], 'person')).candidate).toEqual({
      like: 0,
      dislike: 0,
      selected: null,
    });
  });
  it('counts distinct identities and separates election/candidate keys', async () => {
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => repository.change('test', 'other', String(i), 'like')),
    );
    expect((await repository.read('test', ['other'], null)).other.like).toBe(50);
    expect((await repository.read('another-election', ['other'], null)).other.like).toBe(0);
  });
});
