import Redis from 'ioredis';
const url = process.env.CHAT_REDIS_URL;
if (!url || process.env.SITE_URL !== 'http://localhost:3100')
  throw new Error('Isolated E2E environment required');
const target = new URL(url);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/14')
  throw new Error('Only local Redis DB 14 may be reset');
const redis = new Redis(url);
try {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'ele2026:chat:*', 'COUNT', 100);
    cursor = next;
    if (keys.length) await redis.unlink(...keys);
  } while (cursor !== '0');
  console.log('Chat E2E namespace reset in isolated Redis DB 14. Production DB untouched.');
} finally {
  redis.disconnect();
}
