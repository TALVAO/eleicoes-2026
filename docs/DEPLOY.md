# Publicação gratuita — 04/10/2026

O usuário definiu custo zero e autorizou utilizar este computador ligado durante a apuração. Nenhum recurso pago Render foi criado; não cadastrar pagamento para executar este perfil.

## Arquitetura efetivamente publicada

Navegador → gateway Node 24 na Vercel Hobby → túnel HTTPS gratuito Localtunnel → Next.js neste computador → Redis local → worker Node/Docker → TSE oficial.

Endereço público: https://eleicoes-2026-plum.vercel.app

O Next.js completo, o worker e o Redis permanecem neste computador. A Vercel oferece o endereço público e um gateway controlado. O navegador continua consultando somente a API interna; o túnel transporta conteúdo obtido pelo worker oficial e não é fonte de dados eleitorais.

`deploy/free-gateway` é um projeto Vercel separado: recebe `GATEWAY_ORIGIN` administrativamente, aceita somente HTTPS em subdomínios `.loca.lt`, não aceita URL de destino fornecida pelo visitante, bloqueia redirecionamentos externos, limita a resposta a 4 MiB e aplica timeout de 8 segundos. Preserva os headers necessários à navegação Next.js e devolve erro amigável quando o servidor está indisponível. Não encaminha cookies ou credenciais do visitante ao túnel.

O servidor exige `FREE_GATEWAY_TOKEN`; a Vercel guarda o mesmo segredo como `GATEWAY_TOKEN`. O proxy Next.js autentica a chamada e devolve uma prova HMAC para um nonce novo. O gateway verifica a prova e remove os headers privados antes de responder ao visitante. Isso rejeita páginas do próprio túnel ou uma origem reaproveitada. A prova identifica a origem; a verificação JWS oficial continua ocorrendo no worker. O segredo local fica em `.local/free/gateway-token.txt`, ignorado pelo Git, e nunca é mostrado na interface. O acesso direto ao túnel/local não autentica por padrão nesse perfil; usar o endereço Vercel. Desenvolvimento normal sem essa variável permanece disponível.

`LIVE_TRANSPORT=polling` seleciona atualização da API interna a cada 15 segundos, sem criar EventSource. O worker conserva os intervalos adaptativos e o limite global de 4 requests/s ao TSE. O modo SSE da arquitetura original continua disponível em hospedagem compatível.

## Custo e limites

Não foi contratado plano pago. Vercel usa a conta Hobby existente; este computador fornece CPU, disco, energia e internet já disponíveis. Os limites gratuitos continuam aplicáveis; não há garantia de uptime ou capacidade nacional. O serviço público depende do computador ligado, Docker em execução, Next.js e túnel ativos. Suspensão, reboot ou perda de internet interrompem esse caminho. Não foram alteradas configurações de energia do Windows.

Localtunnel é voltado a testes e compartilhamento, sem disponibilidade garantida. O hostname pode mudar ao reiniciar o túnel; atualizar `GATEWAY_ORIGIN` e publicar o gateway novamente. O endereço Vercel permanece o mesmo. Uma URL emitida pelo túnel não prova conectividade: validar `/api/health` antes de publicar.

O Cloudflare Quick Tunnel foi testado, mas não conseguiu verificar o certificado da conexão de borda neste ambiente, mesmo com as CAs públicas confiáveis. Não foi desativado TLS. A alternativa Localtunnel respondeu com health saudável e foi conectada ao gateway.

## Reinício

Os containers locais `eleicoes2026-redis-local` e `eleicoes2026-worker-local` possuem política `unless-stopped`. Redis usa AOF/noeviction; dados sobrevivem a reinício do container. Não remover/recriar o container Redis sem preservar seu volume.

Para reiniciar todos os helpers, consultar `scripts/start-free.ps1`. O script usa as ferramentas locais já instaladas, registra PIDs em `.local`, inicia helpers ocultos e pode atualizar/publicar o gateway gratuito quando solicitado. Não instala serviços no Windows nem altera firewall ou suspensão.

```powershell
# Parar este projeto (torna o site público indisponível):
.\scripts\stop-free.ps1
# Reiniciar e atualizar a origem gratuita na Vercel:
.\scripts\start-free.ps1 -PublishGateway
```

Os scripts devem ser executados no PowerShell 7 com Docker Desktop disponível. Credenciais Vercel são mantidas pelo CLI oficial; se a sessão expirar, executar `npx vercel login`. O início aguarda prova de origem e heartbeat recente do worker, incluindo a expiração de uma concessão anterior. Um health degradado por backoff do TSE é aceito quando o worker continua ativo, para que o site apresente o último snapshot e o aviso correspondente.

O mesmo início carrega a chave do painel `/chat/moderacao` de `.local/free/chat-admin-token.txt`, criando-a se necessário. Operação, limites e retenção da conversa estão em [CHAT.md](CHAT.md). O chat utiliza o Redis já existente, sem novo serviço pago. Ao compilar neste Windows, caso o Turbopack falhe ao iniciar o processo de CSS, usar o compilador suportado `npm run build -- --webpack`.

## Validações reais

- Redis real: primeiras leituras concorrentes, compartilhamento, renovação, expiração de demandas, troca de liderança e rejeição de escrita antiga.
- Reinício do Redis: snapshots preservados e worker recuperado, health saudável.
- Worker Linux: imagem Docker construída e resultados oficiais com JWS ingeridos em Redis.
- Gateway: segurança de URL, preservação de resposta/headers, erros amigáveis, limite de tamanho e métodos testados.
- Interrupção real do servidor: HTTP 503 com mensagem amigável, inclusive quando o relay retorna sua própria página com HTTP 200; restauração e nova origem publicadas.
- Site público: conferir relatórios da revisão da publicação e health.

`scripts/validate-redis.ts` aceita apenas Redis local, banco 15, para evitar modificar produção. Credenciais Vercel/Render e ferramentas locais não entram no Git.

Fontes técnicas: [Localtunnel oficial](https://github.com/localtunnel/localtunnel), [Vercel Functions](https://vercel.com/docs/functions/limitations), [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
