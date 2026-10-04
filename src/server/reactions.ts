import Redis from 'ioredis';
export type Reaction = 'like' | 'dislike' | null;
export interface ReactionCounts {
  like: number;
  dislike: number;
  selected: Reaction;
}
export class ReactionRepository {
  private connection: Promise<void> | null = null;
  constructor(
    private redis: Redis,
    private prefix = 'ele2026:reactions:',
  ) {}
  private async ready() {
    if (this.redis.status === 'wait' && !this.connection)
      this.connection = this.redis.connect().finally(() => {
        this.connection = null;
      });
    if (this.connection) await this.connection;
    if (this.redis.status !== 'ready') throw new Error('Reactions unavailable');
  }
  async read(election: string, ids: string[], identity: string | null) {
    await this.ready();
    return Object.fromEntries(
      await Promise.all(
        ids.map(async (id) => {
          const key = this.prefix + election + ':' + id;
          const [counts, selected] = await Promise.all([
            this.redis.hgetall(key + ':counts'),
            identity ? this.redis.hget(key + ':people', identity) : null,
          ]);
          return [
            id,
            {
              like: Number(counts.like ?? 0),
              dislike: Number(counts.dislike ?? 0),
              selected: selected === 'like' || selected === 'dislike' ? selected : null,
            },
          ];
        }),
      ),
    ) as Record<string, ReactionCounts>;
  }
  async change(election: string, id: string, identity: string, value: Reaction) {
    await this.ready();
    const key = this.prefix + election + ':' + id;
    await this.redis.eval(
      `
      local previous=redis.call('hget',KEYS[1],ARGV[1])
      local choice=ARGV[2]
      if previous==choice then return 0 end
      if previous then redis.call('hincrby',KEYS[2],previous,-1) end
      if choice=='' then redis.call('hdel',KEYS[1],ARGV[1])
      else redis.call('hset',KEYS[1],ARGV[1],choice); redis.call('hincrby',KEYS[2],choice,1) end
      redis.call('expire',KEYS[1],2592000); redis.call('expire',KEYS[2],2592000)
      return 1`,
      2,
      key + ':people',
      key + ':counts',
      identity,
      value ?? '',
    );
  }
}
let singleton: ReactionRepository | undefined;
export function getReactionRepository() {
  const url = process.env.CHAT_REDIS_URL ?? process.env.REDIS_URL;
  if (!url) throw new Error('Redis required for reactions');
  return (singleton ??= new ReactionRepository(
    new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    }).on('error', () => {}),
  ));
}
