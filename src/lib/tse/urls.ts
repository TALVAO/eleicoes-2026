import type { EA11 } from './schemas';
export const TSE_ORIGIN = 'https://resultados.tse.jus.br';
export const CONFIG_URL = `${TSE_ORIGIN}/oficial/comum/config/ele-c.json`;
export function assertOfficialUrl(value: string): URL {
  const u = new URL(value);
  if (
    u.origin !== TSE_ORIGIN ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !u.pathname.startsWith('/oficial/') ||
    /%|\.\.|[<>\\]/.test(u.pathname)
  )
    throw new Error('Unsafe TSE URL');
  return u;
}
export function padded(code: string, digits: number): string {
  if (!/^\d+$/.test(code) || code.length > digits) throw new Error('Invalid code');
  return code.padStart(digits, '0');
}
export function officialDirectory(
  config: EA11,
  type: string,
  vars: {
    cycle: string;
    election: string;
    pleito: string;
    uf: string;
    municipio?: string;
    zona?: string;
    secao?: string;
  },
): string {
  const item = config.arq.find((a) => a.tp === type);
  if (!item) throw new Error(`Unavailable official directory ${type}`);
  const replacements: Record<string, string> = {
    base: TSE_ORIGIN,
    ambiente: 'oficial',
    ciclo: vars.cycle,
    cd_eleicao: vars.election,
    cd_pleito: vars.pleito,
    uf: vars.uf,
    municipio: vars.municipio ?? '',
    zona: vars.zona ?? '',
    secao: vars.secao ?? '',
  };
  const dir = item.dir.replace(/<([a-z_]+)>/g, (_, k: string) => {
    const v = replacements[k];
    if (!v) throw new Error('Unresolved directory token');
    return v;
  });
  return assertOfficialUrl(dir + '/').href.replace(/\/$/, '');
}
export function resultFilename(
  uf: string,
  office: string,
  election: string,
  municipality?: string,
  zone?: string,
): string {
  if (!/^[a-z]{2}$/.test(uf)) throw new Error('Invalid region');
  return `${uf}${municipality ? padded(municipality, 5) : ''}${zone ? `-z${padded(zone, 4)}` : ''}-c${padded(office, 4)}-e${padded(election, 6)}-u.jws`;
}
