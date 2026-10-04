import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Eleições 2026 — Resultados Oficiais',
    short_name: 'Eleições 2026',
    description: 'Acompanhe a apuração oficial do TSE.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8f6',
    theme_color: '#173c34',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
