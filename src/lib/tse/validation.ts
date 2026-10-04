import { compactVerify, decodeProtectedHeader, importJWK, type JWK } from 'jose';
// Pinned out-of-band: TSE manual 16/09/2026, Appendix B (official).
export const OFFICIAL_JWK: JWK = {
  kty: 'OKP',
  use: 'sig',
  key_ops: ['verify'],
  alg: 'EdDSA',
  kid: 'sNbt9Q_fLS65zE1_ZLNV-XRRwPY',
  crv: 'Ed25519',
  x: 'kWlpNHjuws1csyQZwzn3Fhzbi3RD435RbpThtSr4hMc',
};
export async function verifyOfficialJws(jws: string, key: JWK = OFFICIAL_JWK): Promise<string> {
  const header = decodeProtectedHeader(jws);
  if (header.alg !== 'EdDSA' || header.kid !== key.kid || header.jwk || header.jku || header.x5u)
    throw new Error('Untrusted JWS header');
  const publicKey = await importJWK(key, 'EdDSA');
  const verified = await compactVerify(jws, publicKey, { algorithms: ['EdDSA'] });
  return new TextDecoder('utf-8', { fatal: true }).decode(verified.payload);
}
export function officialTimestamp(
  day: string | undefined,
  time: string | undefined,
): string | null {
  if (!day || !time) return null;
  const parts = day.split('/');
  const value = `${parts[2]}-${parts[1]}-${parts[0]}T${time}-03:00`;
  const parsed = Date.parse(value);
  if (
    !Number.isFinite(parsed) ||
    !/^\d{2}\/\d{2}\/\d{4}$/.test(day) ||
    !/^\d{2}:\d{2}:\d{2}$/.test(time) ||
    new Date(parsed - 3 * 3600_000).toISOString().slice(0, 10) !==
      `${parts[2]}-${parts[1]}-${parts[0]}`
  )
    throw new Error('Invalid official timestamp');
  return value;
}
