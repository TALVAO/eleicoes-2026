import Redis from 'ioredis';
import type { ChatMessage, ChatProfile } from '@/features/chat/types';
export interface Session {
  profile: ChatProfile;
  client: string;
}
export interface ModeratedMessage extends ChatMessage {
  reports: number;
  reasons: string[];
}
export interface ChatRepository {
  rate(key: string, limit: number, seconds: number): Promise<boolean>;
  session(tokenHash: string): Promise<Session | null>;
  saveSession(tokenHash: string, session: Session): Promise<void>;
  blocked(session: Session): Promise<boolean>;
  messages(): Promise<ChatMessage[]>;
  publish(message: ChatMessage, client: string, textHash: string): Promise<boolean>;
  report(id: string, reporter: string, reason: string): Promise<boolean>;
  moderation(): Promise<ModeratedMessage[]>;
  moderate(id: string, action: 'remove' | 'block' | 'dismiss'): Promise<void>;
}
export class RedisChatRepository implements ChatRepository {
  private connection: Promise<void> | null = null;
  constructor(
    private redis: Redis,
    private prefix = 'ele2026:chat:',
  ) {}
  private key(s: string) {
    return this.prefix + s;
  }
  private async ready() {
    if (this.redis.status === 'wait' && !this.connection)
      this.connection = this.redis.connect().finally(() => {
        this.connection = null;
      });
    if (this.connection) await this.connection;
    if (this.redis.status !== 'ready') throw new Error('Chat cache unavailable');
  }
  async rate(key: string, limit: number, seconds: number) {
    await this.ready();
    const count = await this.redis.eval(
      "local n=redis.call('incr',KEYS[1]); if n==1 then redis.call('expire',KEYS[1],ARGV[1]) end; return n",
      1,
      this.key('rate:' + key),
      seconds,
    );
    return Number(count) <= limit;
  }
  async session(token: string) {
    await this.ready();
    const value = await this.redis.get(this.key('session:' + token));
    return value ? (JSON.parse(value) as Session) : null;
  }
  async saveSession(token: string, session: Session) {
    await this.ready();
    await this.redis.set(this.key('session:' + token), JSON.stringify(session), 'EX', 86400);
  }
  async blocked(session: Session) {
    await this.ready();
    return Boolean(
      await this.redis.exists(
        this.key('block:author:' + session.profile.id),
        this.key('block:client:' + session.client),
      ),
    );
  }
  async messages() {
    await this.ready();
    const ids = await this.redis.zrevrangebyscore(
      this.key('messages'),
      '+inf',
      Date.now() - 86400000,
      'LIMIT',
      0,
      100,
    );
    if (!ids.length) return [];
    const values = await this.redis.mget(...ids.map((id) => this.key('message:' + id)));
    return values
      .filter((v): v is string => Boolean(v))
      .map((v) => JSON.parse(v) as ChatMessage)
      .reverse();
  }
  async publish(message: ChatMessage, client: string, textHash: string) {
    await this.ready();
    // Lua makes deduplication, cooldown and insertion atomic across concurrent requests.
    const result = await this.redis.eval(
      `
      if redis.call('exists',KEYS[4],KEYS[5],KEYS[6],KEYS[7])>0 then return 0 end
      redis.call('set',KEYS[4],'1','EX',5)
      redis.call('set',KEYS[5],'1','EX',60)
      redis.call('set',KEYS[2],ARGV[1],'EX',86400)
      redis.call('set',KEYS[3],ARGV[2],'EX',86400)
      redis.call('zadd',KEYS[1],ARGV[3],ARGV[4])
      redis.call('zremrangebyscore',KEYS[1],'-inf',ARGV[5])
      redis.call('zremrangebyrank',KEYS[1],0,-501)
      redis.call('expire',KEYS[1],86400)
      return 1`,
      7,
      this.key('messages'),
      this.key('message:' + message.id),
      this.key('client:' + message.id),
      this.key('cooldown:' + message.author.id),
      this.key('duplicate:' + message.author.id + ':' + textHash),
      this.key('block:author:' + message.author.id),
      this.key('block:client:' + client),
      JSON.stringify(message),
      client,
      Date.parse(message.at),
      message.id,
      Date.now() - 86400000,
    );
    return result === 1;
  }
  async report(id: string, reporter: string, reason: string) {
    await this.ready();
    return (
      (await this.redis.eval(
        `
      if redis.call('exists',KEYS[1])==0 then return 0 end
      if redis.call('sadd',KEYS[2],ARGV[1])==0 then return 0 end
      redis.call('hincrby',KEYS[3],ARGV[2],1)
      redis.call('expire',KEYS[2],86400); redis.call('expire',KEYS[3],86400)
      return 1`,
        3,
        this.key('message:' + id),
        this.key('reporters:' + id),
        this.key('reports:' + id),
        reporter,
        reason,
      )) === 1
    );
  }
  async moderation() {
    const messages = await this.messages();
    const reports = await Promise.all(
      messages.map((m) => this.redis.hgetall(this.key('reports:' + m.id))),
    );
    return messages
      .map((m, i) => ({
        ...m,
        reports: Object.values(reports[i]).reduce((a, n) => a + Number(n), 0),
        reasons: Object.keys(reports[i]),
      }))
      .reverse();
  }
  async moderate(id: string, action: 'remove' | 'block' | 'dismiss') {
    await this.ready();
    await this.redis.eval(
      `
      local raw=redis.call('get',KEYS[1]); if not raw then return 0 end
      if ARGV[1]=='dismiss' then redis.call('del',KEYS[5],KEYS[6]); return 1 end
      if ARGV[1]=='block' then
        local m=cjson.decode(raw)
        redis.call('set',ARGV[2]..'block:author:'..m.author.id,'1','EX',604800)
        local client=redis.call('get',KEYS[2])
        if client then redis.call('set',ARGV[2]..'block:client:'..client,'1','EX',604800) end
      end
      redis.call('zrem',KEYS[3],ARGV[3]); redis.call('del',KEYS[1],KEYS[2],KEYS[5],KEYS[6]); return 1`,
      6,
      this.key('message:' + id),
      this.key('client:' + id),
      this.key('messages'),
      this.key('unused'),
      this.key('reporters:' + id),
      this.key('reports:' + id),
      action,
      this.prefix,
      id,
    );
  }
}
let singleton: RedisChatRepository | undefined;
export function getChatRepository() {
  const url = process.env.CHAT_REDIS_URL ?? process.env.REDIS_URL;
  if (!url) throw new Error('Shared Redis required for chat');
  return (singleton ??= new RedisChatRepository(
    new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    }).on('error', () => {}),
  ));
}
