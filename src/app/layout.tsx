import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Vote, ExternalLink, ShieldCheck } from 'lucide-react';
import '@fontsource-variable/source-sans-3';
import './globals.css';
export const metadata: Metadata = {
  title: 'Eleições 2026 — Resultados ao Vivo',
  description:
    'Acompanhe os resultados oficiais das Eleições 2026 em tempo real, utilizando exclusivamente dados do Tribunal Superior Eleitoral.',
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Eleições 2026 — Resultados ao Vivo',
    description: 'Resultados oficiais do TSE, com transparência e atualização em tempo real.',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: '/opengraph.png',
        width: 1200,
        height: 630,
        alt: 'Eleições 2026 — Resultados oficiais do TSE',
      },
    ],
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Eleições 2026' },
  icons: { icon: '/icon.svg', apple: '/icons/icon-192.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f7f8f6' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#main">
          Pular para os resultados
        </a>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="wordmark" aria-label="Eleições 2026, início">
              <Vote size={30} strokeWidth={1.6} aria-hidden="true" />
              <span>
                ELEIÇÕES <strong>2026</strong>
              </span>
            </Link>
            <div className="official-label">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Dados oficiais do TSE</span>
            </div>
            <a
              className="source-header"
              href="https://resultados.tse.jus.br"
              target="_blank"
              rel="noreferrer"
            >
              Fonte oficial <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="footer-top">
            <Link href="/" className="footer-brand">
              ELEIÇÕES 2026
            </Link>
            <div>
              <Link href="/sobre">Sobre os dados</Link>
              <a href="https://resultados.tse.jus.br" target="_blank" rel="noreferrer">
                Fonte oficial do TSE <ExternalLink size={13} aria-hidden="true" />
              </a>
            </div>
          </div>
          <p>
            Este site é independente e não possui vínculo institucional com o Tribunal Superior
            Eleitoral. Todos os resultados eleitorais exibidos são obtidos diretamente das fontes
            oficiais disponibilizadas pelo TSE.
          </p>
          <span className="footer-note">Horários apresentados no fuso de Brasília.</span>
        </footer>
      </body>
    </html>
  );
}
