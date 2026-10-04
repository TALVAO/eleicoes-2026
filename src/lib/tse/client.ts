import { createHash } from 'node:crypto';
import type { z } from 'zod';
import type { Provenance, SourceStatus } from './types';
import { assertOfficialUrl } from './urls';
import { verifyOfficialJws } from './validation';
export class TSEError extends Error {
  constructor(
    public status: SourceStatus,
    public httpStatus: number | null = null,
    public retryAfterMs: number | null = null,
  ) {
    super(status);
  }
}
export class RequestGate {
  private next = 0;
  private blockedUntil = 0;
  private queue: Promise<void> = Promise.resolve();
  constructor(private requestsPerSecond = 4) {
    if (!Number.isFinite(requestsPerSecond) || requestsPerSecond < 1 || requestsPerSecond > 5)
      throw new Error('Request budget must be 1–5/s');
  }
  block(ms: number) {
    this.blockedUntil = Math.max(this.blockedUntil, Date.now() + ms);
  }
  get rateLimitUntil() {
    return this.blockedUntil;
  }
  async enter() {
    const task = this.queue.then(async () => {
      const now = Date.now();
      const wait = Math.max(this.next, this.blockedUntil) - now;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.next = Date.now() + 1000 / this.requestsPerSecond;
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
export function retryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  return /^\d+$/.test(value) ? Number(value) * 1000 : Math.max(0, Date.parse(value) - now) || null;
}
export class TSEClient {
  get rateLimitUntil() {
    return this.gate.rateLimitUntil;
  }
  constructor(
    private gate = new RequestGate(),
    private fetcher: typeof fetch = fetch,
    private timeout = 8000,
    private maxBytes = 20 * 1024 * 1024,
  ) {
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60_000)
      throw new Error('Invalid transport timeout');
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 50 * 1024 * 1024)
      throw new Error('Invalid transport size limit');
  }
  async photo(url: string): Promise<string> {
    assertOfficialUrl(url);
    await this.gate.enter();
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetcher(url, {
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (response.status === 404) throw new TSEError('unpublished', 404);
      if (response.status === 429) {
        const delay = Math.max(600_000, retryAfter(response.headers.get('retry-after')) ?? 0);
        this.gate.block(delay);
        throw new TSEError('rate-limited', 429, delay);
      }
      if (!response.ok) throw new TSEError('upstream-error', response.status);
      if ((response.headers.get('content-type') ?? '').split(';')[0] !== 'image/jpeg')
        throw new TSEError('invalid-json');
      const reader = response.body?.getReader();
      if (!reader) throw new TSEError('invalid-json');
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          throw new TSEError('invalid-json');
        }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks);
      if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
        throw new TSEError('invalid-json');
      return bytes.toString('base64');
    } catch (e) {
      if (e instanceof TSEError) throw e;
      throw new TSEError(controller.signal.aborted ? 'timeout' : 'upstream-error');
    } finally {
      clearTimeout(timer);
    }
  }
  async get<T>(
    url: string,
    schema: z.ZodType<T>,
    previous?: Provenance,
  ): Promise<{ unchanged: true } | { unchanged: false; data: T; source: Provenance }> {
    assertOfficialUrl(url);
    await this.gate.enter();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const headers: Record<string, string> = {
        Accept: url.endsWith('.jws')
          ? 'application/jose, text/plain, application/octet-stream, application/json'
          : 'application/json',
      };
      if (previous?.etag) headers['If-None-Match'] = previous.etag;
      if (previous?.lastModified) headers['If-Modified-Since'] = previous.lastModified;
      const response = await this.fetcher(url, {
        headers,
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (response.status === 304) {
        if (!previous) throw new TSEError('upstream-error', 304);
        return { unchanged: true };
      }
      if (response.status === 429) {
        const delay = Math.max(600_000, retryAfter(response.headers.get('retry-after')) ?? 0);
        this.gate.block(delay);
        throw new TSEError('rate-limited', 429, delay);
      }
      if (response.status === 404) throw new TSEError('unpublished', 404);
      if (!response.ok) throw new TSEError('upstream-error', response.status);
      const mime = (response.headers.get('content-type') ?? '').split(';')[0].trim();
      const allowed = url.endsWith('.jws')
        ? ['application/jose', 'text/plain', 'application/octet-stream', 'application/json']
        : ['application/json'];
      if (!allowed.includes(mime)) throw new TSEError('invalid-json');
      if (Number(response.headers.get('content-length')) > this.maxBytes)
        throw new TSEError('invalid-json');
      const reader = response.body?.getReader();
      if (!reader) throw new TSEError('invalid-json');
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > this.maxBytes) {
          await reader.cancel();
          throw new TSEError('invalid-json');
        }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks);
      let payload: string;
      if (url.endsWith('.jws')) {
        try {
          payload = await verifyOfficialJws(bytes.toString('utf8').trim());
        } catch {
          throw new TSEError('invalid-signature');
        }
      } else {
        try {
          payload = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          throw new TSEError('invalid-json');
        }
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        throw new TSEError('invalid-json');
      }
      const result = schema.safeParse(parsed);
      if (!result.success) throw new TSEError('schema-incompatible');
      return {
        unchanged: false,
        data: result.data,
        source: {
          url,
          generatedAt: null,
          fetchedAt: new Date().toISOString(),
          etag: response.headers.get('etag'),
          lastModified: response.headers.get('last-modified'),
          hash: createHash('sha256').update(payload).digest('hex'),
          validation: url.endsWith('.jws') ? 'signature-verified' : 'schema-verified',
        },
      };
    } catch (e) {
      if (e instanceof TSEError) throw e;
      throw new TSEError(controller.signal.aborted ? 'timeout' : 'upstream-error');
    } finally {
      clearTimeout(timer);
    }
  }
}
