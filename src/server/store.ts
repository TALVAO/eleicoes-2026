import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, readdir, unlink, open } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import Redis from 'ioredis';
export interface Store {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T, lease?: string): Promise<void>;
  demand(key: string): Promise<void>;
  demands(): Promise<string[]>;
  acquire(token: string): Promise<boolean>;
  renew(token: string): Promise<boolean>;
  release(token: string): Promise<void>;
  close(): Promise<void>;
}
const LEASE_MS = 30_000;
class FileStore implements Store {
  constructor(private dir: string) {}
  private path(key: string) {
    return join(this.dir, createHash('sha256').update(key).digest('hex') + '.json');
  }
  async get<T>(key: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(this.path(key), 'utf8')) as T;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }
  async put<T>(key: string, value: T, lease?: string) {
    await mkdir(this.dir, { recursive: true });
    if (lease && (await this.get<{ token: string; expires: number }>('lease'))?.token !== lease)
      throw new Error('Lost ingestion lease');
    const tmp = this.path(key) + '.' + randomUUID() + '.tmp';
    await writeFile(tmp, JSON.stringify(value), 'utf8');
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(tmp, this.path(key));
          break;
        } catch (e) {
          const code = (e as NodeJS.ErrnoException).code;
          if (!['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '') || attempt >= 7) throw e;
          // Windows readers / antivirus can briefly hold a destination open.
          await new Promise((r) => setTimeout(r, Math.min(25 * 2 ** attempt, 100)));
        }
      }
    } catch (e) {
      await unlink(tmp).catch(() => {});
      throw e;
    }
  }
  async demand(key: string) {
    await mkdir(join(this.dir, 'demands'), { recursive: true });
    await writeFile(
      join(this.dir, 'demands', Buffer.from(key).toString('base64url')),
      String(Date.now() + 90_000),
    );
  }
  async demands() {
    const folder = join(this.dir, 'demands');
    await mkdir(folder, { recursive: true });
    const active: string[] = [];
    for (const file of await readdir(folder)) {
      const p = join(folder, file);
      try {
        const expires = Number(await readFile(p, 'utf8'));
        if (expires > Date.now()) active.push(Buffer.from(file, 'base64url').toString());
        else await unlink(p);
      } catch {
        /* demand expires concurrently */
      }
    }
    return active.slice(0, 100);
  }
  async acquire(token: string) {
    await mkdir(this.dir, { recursive: true });
    const path = this.path('lease');
    try {
      const handle = await open(path, 'wx');
      await handle.writeFile(JSON.stringify({ token, expires: Date.now() + LEASE_MS }));
      await handle.close();
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      const lease = await this.get<{ token: string; expires: number }>('lease');
      if (lease && lease.expires < Date.now()) {
        await unlink(path).catch(() => {});
      }
      return false;
    }
  }
  async renew(token: string) {
    const lease = await this.get<{ token: string; expires: number }>('lease');
    if (lease?.token !== token || lease.expires < Date.now()) return false;
    await this.put('lease', { token, expires: Date.now() + LEASE_MS });
    return true;
  }
  async release(token: string) {
    if ((await this.get<{ token: string }>('lease'))?.token === token)
      await unlink(this.path('lease')).catch(() => {});
  }
  async close() {}
}
class RedisStore implements Store {
  private redis: Redis;
  private connecting: Promise<void> | null = null;
  constructor(url: string) {
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    this.redis.on('error', () => {});
  }
  private async ready() {
    if (this.redis.status === 'wait' && !this.connecting) {
      this.connecting = this.redis.connect().finally(() => {
        this.connecting = null;
      });
    }
    if (this.connecting) await this.connecting;
    if (this.redis.status !== 'ready') throw new Error('Cache unavailable');
  }
  private key(key: string) {
    return 'ele2026:' + key;
  }
  async get<T>(key: string): Promise<T | null> {
    await this.ready();
    const v = await this.redis.get(this.key(key));
    return v ? (JSON.parse(v) as T) : null;
  }
  async put<T>(key: string, value: T, lease?: string) {
    await this.ready();
    if (lease) {
      const ok = await this.redis.eval(
        "if redis.call('get',KEYS[1])==ARGV[1] then redis.call('set',KEYS[2],ARGV[2]); return 1 else return 0 end",
        2,
        this.key('lease'),
        this.key(key),
        lease,
        JSON.stringify(value),
      );
      if (ok !== 1) throw new Error('Lost ingestion lease');
    } else await this.redis.set(this.key(key), JSON.stringify(value));
  }
  async demand(key: string) {
    await this.ready();
    await this.redis.zadd(this.key('demands'), Date.now() + 90_000, key);
  }
  async demands() {
    await this.ready();
    await this.redis.zremrangebyscore(this.key('demands'), '-inf', Date.now());
    return this.redis.zrange(this.key('demands'), 0, 99);
  }
  async acquire(token: string) {
    await this.ready();
    return (await this.redis.set(this.key('lease'), token, 'PX', LEASE_MS, 'NX')) === 'OK';
  }
  async renew(token: string) {
    await this.ready();
    return (
      (await this.redis.eval(
        "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('pexpire',KEYS[1],ARGV[2]) else return 0 end",
        1,
        this.key('lease'),
        token,
        LEASE_MS,
      )) === 1
    );
  }
  async release(token: string) {
    await this.ready();
    await this.redis.eval(
      "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
      1,
      this.key('lease'),
      token,
    );
  }
  async close() {
    this.redis.disconnect();
  }
}
export function createStore(): Store {
  if (process.env.REDIS_URL) return new RedisStore(process.env.REDIS_URL);
  if (process.env.VERCEL) throw new Error('Shared Redis required on Vercel');
  return new FileStore(
    join(resolve(/* turbopackIgnore: true */ process.env.CACHE_DIR ?? '.data'), 'v1'),
  );
}
let singleton: Store | undefined;
export const getStore = () => (singleton ??= createStore());
