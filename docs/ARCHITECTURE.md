# Arquitetura e decisões

## Perfil gratuito efetivamente publicado

Após a entrega inicial, o usuário definiu custo zero e autorizou este computador como servidor. Vercel Hobby → gateway controlado em `deploy/free-gateway` → Localtunnel HTTPS → Next.js local → Redis local + worker Docker. Não foram criados serviços pagos. `LIVE_TRANSPORT=polling` atualiza a API interna a cada 15 s. O cache e os dados continuam centralizados, com a validação oficial original. O gateway não busca resultados diretamente no TSE.

A disponibilidade depende do computador, Docker, internet e túnel; não há garantia de produção nacional. O hostname do túnel pode mudar e exigir atualização do gateway. Detalhes/reinício em [DEPLOY.md](DEPLOY.md). As decisões seguintes registram o caminho preparado para hospedagem persistente independente do computador.

## Limites de responsabilidade

| Camada             | Implementação                                        | Responsabilidade                                                           |
| ------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Transporte         | `src/lib/tse/client.ts`, `urls.ts`                   | Whitelist, TLS, timeout, MIME, tamanho, condicionais, orçamento global     |
| Integridade/parser | `validation.ts`, `schemas/index.ts`                  | JWS Ed25519 fixado, JSON estrito nos campos utilizados                     |
| Adapter            | `adapters/elections.ts`, `results.ts`, `exterior.ts` | Configuração e modelos internos sem inferir números ausentes               |
| Cache              | `cache.ts`, `src/server/store.ts`                    | Histórico atual/anterior, hash, concessão Redis e escritas protegidas      |
| Ingestão           | `src/server/ingestion.ts`, `worker.ts`               | Configuração dinâmica, indicadores EA14/15, jobs demandados, backoff       |
| API interna        | `src/app/api`                                        | Leitura do cache, validação de queries, SSE, health e fotos já armazenadas |
| Interface          | `src/components`, `features/elections/live-store.ts` | Domínio validado, atualização por revisão, estados editoriais e offline    |

Os diretórios por feature contêm a superfície de eleição e os adapters dedicados ficam em `lib/tse/adapters`. Não há JSON do TSE no componente de interface. `docs/sources` não integra output de produção e não é importado por `src`.

## Configuração dinâmica

EA11 é consultado na inicialização. Data e turno selecionam pleito; o cargo presidencial e o tipo oficial identificam a eleição federal. Ciclo, códigos e templates vêm de EA11. EA12 confirma abrangências e municípios; configurações das demais eleições filtram a disponibilidade dos cargos. Códigos de município são mantidos como strings de cinco posições. Não se tenta descobrir arquivos enumerando combinações arbitrárias.

Uma divergência de configuração reconstrói os jobs. Sem configuração válida, não há resultado substituto. Catálogo validado anteriormente pode continuar disponível com degradação do worker; a fonte oficial volta a ser revalidada.

## Produção: Vercel + worker + Redis

Next.js fornece SSR, assets, API interna e SSE de duração limitada. Worker Node persistente concentra chamadas oficiais. Redis é compartilhado por todos os processos, sem TTL nos últimos snapshots, com TTL na concessão de liderança. Redis deve ser persistente e não expulsar snapshots por pressão de memória.

Funções Vercel possuem duração finita, inclusive ao transmitir respostas: [limitações oficiais](https://vercel.com/docs/functions/limitations). Não se usa um timer de ingestão dentro delas, nem um cron por cliente. SSE termina em 50 segundos antes do limite de 60; EventSource reconecta em 3 segundos. O endpoint reconhece Last-Event-ID. Heartbeats mantêm a conexão; revisões não incluem o relógio volátil, para evitar emissão contínua de payload idêntico.

Sem SSE, fetch interno a cada 15 segundos continua lendo o mesmo cache. A lista de UFs também usa essa frequência. Mesmo muitos clientes não aumentam chamadas ao TSE; aumentam leituras de Redis e conexões da aplicação. Não confundir isolamento da CDN com capacidade ilimitada do frontend.

## Demanda e priorização

Presidente nacional, Exterior e UFs ficam registrados. Demais cargos e municípios são ativados por queries validadas na configuração, com demanda que expira em 90 segundos e limite de 100 recursos demandados ativos. Não há ingestão de todos os municípios e cargos indiscriminadamente.

EA14 indica mudanças em UFs; EA15 indica mudanças municipais em escopos ativos. Geração paralela/CDN pode produzir defasagem entre indicadores e EA20; fallback periódico evita depender somente do indicador. Intervalos são alvos de agendamento; limite global, fila e latência podem ampliá-los.

## Segurança e dados

O backend não recebe URL do usuário. Queries aceitam somente UF, cargo e município cadastrados. Downloads eleitorais passam por origem exata HTTPS `resultados.tse.jus.br`, prefixo `/oficial/`, sem redirecionamento, credenciais, querystring nem segmentos ambíguos. Fotos saem do cache pelo proxy, com JPEG/MIME/magic bytes e limite de 2 MiB.

React escapa texto; parser remove controles/bidi e limita tamanho. Há CSP, bloqueio de frame, MIME sniffing e recursos de dispositivo. Scripts inline são necessários à hidratação padrão do Next; não há HTML de fornecedor injetado.

Credenciais Redis são server-side. `/api/health` retorna exclusivamente diagnóstico público. Logs estruturados não registram headers secretos. A chave JWS é material público de verificação fixado fora do payload, não uma credencial.

## PWA e acessibilidade

Service worker armazena shell offline e assets locais. Não cacheia API, SSE ou resultados como se fossem atuais. O último modelo recebido fica no dispositivo com horário explícito; sem conexão a interface avisa. Shell offline mostra somente dados que efetivamente foram recebidos e não apresenta preparação como apuração.

Fonte self-hosted, navegação semântica, skip link, foco visível, labels associados, status acessível, alvos 44px e reduced-motion. SSR já mostra a espera/resultado antes da hidratação. Linhas de candidato e métricas são memoizadas; arrays de candidatos são preservados quando o hash não mudou. Não há animação de layout no recebimento de votos.

## Limites operacionais

O modo de arquivos é local, não distribuído. Redis é requerido para produção na Vercel. A arquitetura evita polling de TSE por navegador, mas SSE por cliente com leitura de Redis em 2 segundos precisa de dimensionamento de custos e teste de carga. Para audiência muito grande, usar um gateway persistente que distribua mensagens por pub/sub. Não houve benchmark massivo, failover Redis real ou publicação deste projeto.
