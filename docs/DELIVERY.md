# Relatório de entrega — 04/10/2026

## Atualização: publicação gratuita

Após a entrega local, o site foi publicado em **https://eleicoes-2026-plum.vercel.app**, por solicitação do usuário e com custo zero de contratação. Vercel Hobby hospeda um gateway; este computador mantém Next.js, worker e Redis local, via túnel HTTPS Localtunnel. O usuário autorizou mantê-lo ligado durante a apuração. Não foram criados serviços Render pagos. Atualização de clientes a cada 15 s; ingestão adaptativa original preservada.

Validação adicional: 64 unitários, 22 E2E, Redis real (concorrência inicial, liderança expirada/troca/fencing), persistência após reinício, worker Linux com dados/JWS oficiais e teste do endereço público em desktop/iPhone. O teste público verificou navegação, polling sem SSE, ausência de overflow/erros de cliente e axe sem violações nos cenários analisados. Os scores Lighthouse abaixo são da medição local anterior e não foram apresentados como scores do túnel.

O perfil gratuito depende deste computador, internet e túnel, sem garantia de uptime/capacidade nacional. Reinício do túnel pode alterar sua origem e exige atualizar o gateway. Procedimento em [DEPLOY.md](DEPLOY.md). As seções seguintes preservam o relatório da entrega local inicial e a arquitetura alternativa preparada.

## Entrega funcional

Projeto Next.js 16.3.8 / React 19.3.0, TypeScript estrito, App Router, Tailwind CSS, Zod, Vitest e Playwright. Páginas Brasil, Estados, Municípios, Exterior e transparência. UI editorial clara, fonte local, acessibilidade, PWA, OpenGraph e estados de espera/erro/offline. A prévia local roda em `http://localhost:3000` com ingestão oficial independente.

Os arquivos oficiais consultados ainda estavam em preparação, antes de 17h. A interface corretamente exibe “Apuração ainda não liberada”, sem candidatos/zeros de preparação como resultado. Apuração e falhas foram exercitadas em testes isolados, nunca no cache normal.

## Arquitetura utilizada

TSE HTTPS → worker Node persistente → assinatura JWS + schemas Zod → adapters de domínio → cache atual/anterior → API Next.js → SSE / fallback interno → componentes memoizados. O navegador não consulta o TSE para obter resultados ou fotos.

Produção preparada para frontend/API na Vercel e worker em serviço persistente com Redis TCP compartilhado. SSE Vercel tem duração limitada de 50 segundos, reconexão e heartbeat; ingestão contínua fica fora das funções. Cache local atômico serve para desenvolvimento. Dockerfile, compose de ensaio e CI estão incluídos.

## Endpoints oficiais utilizados

Todos sob `https://resultados.tse.jus.br`, ambiente `oficial`. EA11 é a fonte de códigos/diretórios; os caminhos abaixo registram o que foi observado, não constantes de eleição usadas pelo runtime:

| Recurso                   | Caminho observado                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| EA11                      | `/oficial/comum/config/ele-c.json`                                                                  |
| EA12                      | `/oficial/ele2026/{6257,6259,6261}/config/mun-e00{6257,6259,6261}-cm.json` — um arquivo por eleição |
| EA14                      | `/oficial/ele2026/6257/dados/br/br-e006257-ab.jws`, equivalentes das eleições configuradas          |
| EA15                      | `/oficial/ele2026/6257/dados/zz/zz-e006257-ab.jws`, equivalentes de UFs demandadas                  |
| EA20 Brasil               | `/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.jws`                                             |
| EA20 Exterior             | `/oficial/ele2026/6257/dados/zz/zz-c0001-e006257-u.jws`                                             |
| EA20 UF/cargo             | diretório EA11 `u`, `{uf}-c{cargo:4}-e{eleição:6}-u.jws`                                            |
| EA20 município/localidade | `{uf}{município:5}-c{cargo:4}-e{eleição:6}-u.jws`                                                   |
| EA16 Exterior             | `/oficial/ele2026/arquivo-urna/3220/config/zz/zz-p003220-cs.json`                                   |
| Fotos                     | diretório EA11 `ft`, `{sqcand}.jpeg`, somente cache interno no navegador                            |

EA20 real com JWS foi validado para Brasil, Exterior, todas as UFs presidenciais, governador/senador/deputados federal e estadual do Acre, deputado distrital do DF e município 01120/AC. Foto oficial armazenada foi servida com HTTP 200 / `image/jpeg`. EA10 não substitui resultado presidencial; EA18 não está habilitado sem amostra/documentação extraível.

## Exterior

Identificado por `abr.ds=EXTERIOR` e código `zz` na EA12, cruzado com configuração e documentação EA16. `TSEExteriorAdapter` expõe consolidado, localidades, zonas e seções disponíveis. EA20 localidade usa `tpabr=mu`; EA15 capturado usa `mun`. Não há inferência de países. Brasil inclui o Exterior; comparação utiliza percentuais oficiais de ambos e conserva o consolidado quando se seleciona uma localidade.

## Frequência efetiva e cache

Base crítica 2 s; inatividade aumenta gradualmente até 30 s. EA15 mínimo 10 s, UFs/municípios domésticos fallback 60 s, configuração 5 min, cadastro EA16 1 h. Indicadores EA14/15 antecipam EA20 quando há mudança; a fila/latência/orçamento podem ampliar esses intervalos. O limite global configurado é **4 requests/s**, incluindo fotos e 304.

ETag/If-None-Match e Last-Modified/If-Modified-Since são utilizados. 304 conserva os snapshots. `current`/`previous` possuem URL, geração, recebimento, hash SHA-256, headers e validação. Apenas alteração de conteúdo/status relevante gera snapshot SSE; heartbeat atualiza a saúde da conexão sem republicar resultado. Compartilhamento de objetos preserva linhas/métricas sem mudança.

## Failover e integridade

Falha de JSON/schema/assinatura não substitui o último válido. UI identifica o último resultado e mostra falha temporária. 404 tem pausa mínima de 5 min; 429 pausa global mínima 10 min/Retry-After, persistida no cache e restaurada após reinício. O heartbeat continua durante a pausa. 5xx/timeout usam backoff com jitter.

Redis coordena liderança por concessão de 30 s, renovada em 8 s, com escrita protegida. Worker reserva pode assumir concessão expirada; supervisor mantém reinício. Persistência/backups/failover do próprio Redis dependem do serviço escolhido. Offline usa último modelo recebido, datado, sem apresentar cache como atual.

Verificação Ed25519/JWK oficial do manual, fixada fora dos arquivos recebidos. Não há fallback para JSON sem assinatura em resultados/indicadores. Configurações recebem validação estrutural/TLS, com nível registrado. Verificação completa X.509/CRL não foi implementada.

## Verificações executadas

| Verificação           | Resultado                                                                            |
| --------------------- | ------------------------------------------------------------------------------------ |
| ESLint                | Passou                                                                               |
| TypeScript `--noEmit` | Passou                                                                               |
| Vitest                | **60 testes, 4 arquivos, todos passaram**                                            |
| Playwright            | **22 testes, todos passaram**, desktop e iPhone Chromium                             |
| Produção `next build` | Passou                                                                               |
| Auditoria de fontes   | 42 arquivos de produção inspecionados, 11 capturas oficiais, 3 JWS reais verificados |
| Acessibilidade axe    | Sem violações nos cenários analisados de espera/apuração                             |
| Responsividade        | Sem overflow em 1440px / 390px nas capturas verificadas                              |
| Health/API/foto       | Cache real, health saudável HTTP 200, APIs e assinaturas verificadas                 |
| Dependências produção | `npm audit --omit=dev`: zero advisories na revisão                                   |

Lighthouse local, estado de espera oficial:

| Categoria      | Mobile  | Desktop |
| -------------- | ------- | ------- |
| Performance    | **99**  | **100** |
| Accessibility  | **100** | **100** |
| Best Practices | **100** | **100** |
| SEO            | **100** | **100** |

Relatórios completos: `lighthouse-mobile.json` e `lighthouse-desktop.json`. Medições locais não garantem os mesmos scores sob outras redes, listas maiores ou carga de produção. A revisão independente Impeccable considerou resolvidos os quatro ajustes de feed, gate presidencial nos estados, datas completas e alvos de toque, em capturas/fonte. Seu veredito foi `ship` nesse escopo, não uma homologação geral de infraestrutura.

## Limitações restantes

1. Resultados reais já liberados de apuração/finalização não estavam disponíveis durante a execução. Transições de teste são explicitamente isoladas.
2. Não há distribuição por país nos arquivos consumidos. Só mostramos localidades que o TSE fornece.
3. EA18 não foi implementado por ausência de amostra identificada e timeout ao extrair o PDF oficial. EA15 foi implementado pelo JSON real e FAQ; extração integral do PDF não funcionou. EA10 tem schema documental e não é fonte de vencedor presidencial.
4. Redis real, recuperação do provedor e carga massiva não foram ensaiados neste ambiente. Docker está instalado, mas o daemon não estava disponível. O teste de cache local incluiu concorrência, persistência e concessão; o cooldown foi testado em troca de worker.
5. iPhone foi emulado em Chromium. Safari físico/WebKit não foi homologado.
6. Fotos têm prioridade inferior aos resultados e podem atrasar; ausência usa avatar neutro.
7. Há cinco advisories de desenvolvimento na cadeia ESLint Next / micromatch / braces, sem correção compatível disponível na revisão. Dependências de produção não apresentaram advisories. Não foi executado downgrade destrutivo do framework.
8. SSE por cliente faz leituras periódicas de Redis. Audiência muito grande exige teste de capacidade/custo e, possivelmente, gateway persistente com pub/sub/fanout.

## Implantação

Consulte o README para comandos completos. Criar repositório com o código/lockfile, preservando exclusões de cache/credenciais. Provisionar Redis autenticado com TLS, persistência e `noeviction`. Executar `Dockerfile.worker` em Node persistente, definir seletores da eleição e orçamento. Importar o repositório na Vercel e definir o mesmo `REDIS_URL`, `SITE_URL` público e configurações. Após build, validar `/api/health`, Brasil, Exterior, UF, município, assinaturas, reconexão e offline. Configurar monitoramento e ensaiar carga/failover antes de tráfego amplo.

A entrega é local e preparada para implantação; nenhum serviço externo foi publicado ou provisionado.
