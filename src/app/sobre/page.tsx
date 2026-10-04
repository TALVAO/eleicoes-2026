import { Navigation } from '@/components/navigation';
export default function Page() {
  return (
    <>
      <Navigation active="" />
      <main id="main" className="container about-page">
        <h1>Dados oficiais. Contexto transparente.</h1>
        <p className="about-lead">
          A apuração pertence à Justiça Eleitoral. Nosso trabalho é tornar os arquivos oficiais
          fáceis de acompanhar, com clareza sobre a origem e o horário de cada atualização.
        </p>
        <section>
          <h2>Uma única fonte</h2>
          <p>
            O sistema utiliza exclusivamente os arquivos públicos de resultados do Tribunal Superior
            Eleitoral. Códigos de eleições, municípios e abrangências são obtidos da configuração
            oficial. Não utilizamos resultados de portais de notícias ou APIs de terceiros.
          </p>
        </section>
        <section>
          <h2>Assinatura e procedência</h2>
          <p>
            Os arquivos de resultados são verificados com a chave pública oficial do TSE. Uma falha
            de validação impede a atualização. Quando existe um resultado válido anterior, ele
            permanece visível com um aviso.
          </p>
        </section>
        <section>
          <h2>Ausência não significa zero</h2>
          <p>
            Antes da divulgação, mostramos um estado de espera. Zero só é apresentado quando consta
            explicitamente em um resultado oficialmente divulgado. Campos ausentes permanecem
            indisponíveis.
          </p>
        </section>
        <section>
          <h2>Brasil e Exterior</h2>
          <p>
            O resultado presidencial Brasil já inclui os votos do Exterior. A comparação utiliza os
            percentuais publicados para cada abrangência; ela não subtrai o Exterior do Brasil.
            Localidades são obtidas do cadastro oficial. Não inferimos países a partir de nomes de
            cidades.
          </p>
        </section>
        <section>
          <h2>O que é calculado aqui</h2>
          <p>
            A diferença de votos e de pontos percentuais entre candidatos e os eventos do feed são
            métricas derivadas dos snapshots oficiais. Nenhuma projeção de vencedor é produzida. A
            situação eleitoral exibida é a publicada pelo TSE.
          </p>
        </section>
        <section>
          <h2>Atualização e conexão</h2>
          <p>
            Uma camada central consulta o TSE, reduzindo a frequência quando não há mudanças e em
            caso de erros. O navegador recebe atualizações do nosso servidor. Dados antigos, falhas
            de conexão e o cache offline são identificados explicitamente.
          </p>
          <a
            className="text-link"
            href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados"
          >
            Consultar a documentação técnica oficial
          </a>
        </section>
      </main>
    </>
  );
}
