# Confiabilidade e operação

## Agendamento real

| Recurso / situação                 | Intervalo configurado                            |
| ---------------------------------- | ------------------------------------------------ |
| Nacional/Exterior/EA14 com mudança | Base 2 s                                         |
| Sem mudança                        | Cresce 1,5× até 30 s para críticos               |
| EA15 ativo                         | Mínimo 10 s                                      |
| EA20 UF ou município doméstico     | Fallback mínimo 60 s; indicador pode antecipar   |
| Configuração EA11/EA12             | 5 min                                            |
| Cadastro EA16 Exterior             | 1 h                                              |
| Foto oficial em job ativo          | Mínimo 24 h, primeiro job após 60 s              |
| 404                                | Mínimo 5 min + jitter                            |
| 429                                | Pausa global mínima 10 min, ou Retry-After maior |
| Outros erros                       | 5 s × 2^(falhas−1), até 5 min, + jitter          |

Um único gate compartilha orçamento de 4 req/s entre todos os arquivos e fotos; configuração não admite mais de 5. Não são 4 req/s por UF. Latência, fila e backoff aumentam o intervalo observado. EA14/15 antecipam resultados somente em recursos sem falha corrente, evitando furar backoff. EA20 tem fallback independente para propagação desigual da CDN.

A pausa global por 429 fica persistida em `tse:block-until`, é restaurada na troca de líder e não impede a publicação de heartbeat do worker. Não se inicia outro download durante essa pausa, nem mesmo EA11. Um job de resultado também restaura `nextPollAt`/falhas de seu cache antes de insistir em recurso ausente após reinício.

100 req/s/IP é o limite documentado do TSE, não o alvo do sistema. 304 também conta. Bloqueios por insistência podem reiniciar o período de bloqueio: o worker suspende globalmente chamadas após 429. Outros serviços no mesmo IP devem compartilhar o orçamento operacional.

## Último estado confiável

Download → verificação JWS quando exigida → JSON → Zod → validação de eleição/turno/abrangência → adapter → commit. Somente esse caminho escreve `current`.

Hash igual: mantém `current/previous`, atualiza verificação de transporte, não inventa evento. Hash novo: anterior recebe current, current recebe snapshot validado. HTTP 304 não exige parsing, mas requer metadados/objeto anterior; 304 sem cache é tratado como erro.

Falha de assinatura/schema/JSON preserva snapshot válido e publica situação degradada. Dados inválidos não substituem cache. A mensagem de validação é visível, com indicação do último válido. Hashes, ETag/Last-Modified e timestamps ficam associados ao snapshot de conteúdo, não a um número eleitoral recomposto.

O feed compara somente snapshots do mesmo **resultado completo**: eleição, UF, município e cargo. Atualizações iniciais/preparatórias não geram eventos. Reduções de votos são apresentadas como correções derivadas; não assumimos crescimento monotônico.

## Failover

Redis tem concessão de liderança de 30 s, renovada em 8 s e escritas protegidas por Lua. Worker reserva pode adquirir a concessão expirada; saída normal a libera. Perda de concessão interrompe o worker. Supervisor/container deve reiniciar processo que falhar. Snapshots são persistidos sem TTL; ativar AOF/backups e evitar expulsão por memória.

Cache indisponível: API 503 com mensagem de serviço, SSR em estado de indisponibilidade e cliente preservando a última visão. Não há consulta ao TSE pela API como fallback. Sem cache local recebido, não há resultado a mostrar. Esta implementação não replica Redis por si própria; failover de Redis deve ser fornecido/ensaiado pelo serviço escolhido.

Sem SSE: fallback para API interna a cada 15 s. SSE tem sessão 50 s, reconexão 3 s e heartbeat; último Event-ID evita repetição desnecessária. Sem internet: aviso offline e último snapshot do dispositivo, datado. Service worker não transforma API antiga em “ao vivo”.

## Observabilidade

`GET /api/health` responde com `status,lastSuccessfulFetch,lastTSEUpdate,lastSnapshotHash,sourceStatus,pollingStatus,nextPollAt`. Heartbeat parado por mais de 45 s retorna 503. Falha de recurso opcional não prova queda geral do TSE. A interface diz “conexão instável”; não declara o serviço inteiro fora do ar.

Logs JSON: `configuration.validated`, `configuration.error`, `snapshot.committed`, `source.error`, `worker.leader`, `worker.lease-lost`, `worker.cache-unavailable`, `worker.failure`. `source.error` informa recurso, classificação, HTTP e próxima tentativa, sem mostrar erro técnico ao visitante.

Antes de anunciar disponibilidade: conferir configuração, horário do worker, heartbeat, assinaturas, URL efetiva, geração/recebimento, acesso de Vercel ao Redis, reconexão e shell offline. Para tráfego de eleição, monitorar também conexões, latência Redis, memória e orçamento agregado do IP.

## Integridade e recuperação

Chave JWS fixada no apêndice B do manual oficial. Não seguir `jku/x5u` ou chave embutida. Não aceitar alteração da chave por variável arbitrária. Para rotação oficial, revisar manual atualizado, chave e testes com JWS real, publicar versão e registrar evidência. Não desabilitar assinatura para recuperar disponibilidade.

Timeout de 8 s, limite de payload de 20 MiB, validação MIME e abort de leitura. Fotos têm limite de 2 MiB. Redirecionamento é erro. Origem exata e templates oficiais evitam SSRF. Cabeçalhos e textos são tratados no servidor; strings são escapadas na renderização.

## Cobertura e limites

Unitários: schemas/capturas reais, percentuais, ordem, ausências/zero, Exterior, municípios, HTTP304/404/429/5xx, timeout, tamanho, MIME, assinatura, cache/feed e revisão SSE. E2E: desktop/iPhone Chromium, espera, apuração via transições isoladas, acessibilidade axe, navegação, validação falha, offline e reconexão após término de sessão.

Lighthouse é medição local do estado preparatório, não garantia sobre produção com tráfego alto ou sobre listas extensas de candidatos. Não foram executados ensaio de falha Redis real, teste massivo nacional ou Safari físico. Ver relatório de entrega; não ocultar esses limites ao dimensionar o ambiente.
