'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container error-page">
      <h1>Não foi possível atualizar esta página.</h1>
      <p>Os dados oficiais permanecem preservados. Tente novamente em instantes.</p>
      <button onClick={reset}>Tentar novamente</button>
    </main>
  );
}
