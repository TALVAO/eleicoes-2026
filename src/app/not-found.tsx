import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="container error-page">
      <h1>Página não encontrada</h1>
      <p>Volte à apuração nacional para continuar.</p>
      <Link className="text-link" href="/">
        Ver resultados Brasil
      </Link>
    </main>
  );
}
