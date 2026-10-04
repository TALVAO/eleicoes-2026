import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/estados', '/municipios', '/exterior', '/sobre'].map((path) => ({
    url: new URL(path || '/', process.env.SITE_URL ?? 'http://localhost:3000').href,
  }));
}
