# Publicação gratuita — 04/10/2026

O usuário definiu custo zero e autorizou utilizar este computador ligado durante a apuração. Nenhum recurso pago Render foi criado; não cadastrar pagamento para executar este perfil.

## Arquitetura efetivamente publicada

Navegador → gateway Node 24 na Vercel Hobby → túnel HTTPS gratuito Localtunnel → Next.js neste computador → Redis local → worker Node/Docker → TSE oficial.

Endereço público: https://eleicoes-2026-plum.vercel.app

O Next.js completo, o worker e o Redis permanecem neste computador. A Vercel oferece o endereço público e um gateway controlado. O navegador continua consultando somente a API interna; o túnel transporta conteúdo obtido pelo worker oficial e não é fonte de dados eleitorais.

`deploy/free-gateway` é um projeto Vercel separado: recebe `GATEWAY_ORIGIN` administrativamente, aceita somente HTTPS em subdomínios `.loca.lt`, não aceita URL de destino fornecida pelo visitante, bloqueia redirecionamentos externos, limita a resposta a 4 MiB e aplica timeout de 8 segundos. Preserva os headers necessários à navegação Next.js e devolve erro amigável quando o servidor está indisponível. Não encaminha cookies ou credenciais do visitante ao túnel.

`LIVE_TRANSPORT=polling` seleciona atualização da API interna a cada 15 segundos, sem criar EventSource. O worker conserva os intervalos adaptativos e o limite global de 4 requests/s ao TSE. O modo SSE da arquitetura original continua disponível em hospedagem compatível.

## Custo e limites

Não foi contratado plano pago. Vercel usa a conta Hobby existente; este computador fornece CPU, disco, energia e internet já disponíveis. Os limites gratuitos continuam aplicáveis; não há garantia de uptime ou capacidade nacional. O serviço público depende do computador ligado, Docker em execução, Next.js e túnel ativos. Suspensão, reboot ou perda de internet interrompem esse caminho. Não foram alteradas configurações de energia do Windows.

Localtunnel é voltado a testes e compartilhamento, sem disponibilidade garantida. O hostname pode mudar ao reiniciar o túnel; atualizar `GATEWAY_ORIGIN` e publicar o gateway novamente. O endereço Vercel permanece o mesmo. Uma URL emitida pelo túnel não prova conectividade: validar `/api/health` antes de publicar.

O Cloudflare Quick Tunnel foi testado, mas não conseguiu verificar o certificado da conexão de borda neste ambiente, mesmo com as CAs públicas confiáveis. Não foi desativado TLS. A alternativa Localtunnel respondeu com health saudável e foi conectada ao gateway.

## Reinício

Os containers locais `eleicoes2026-redis-local` e `eleicoes2026-worker-local` possuem política `unless-stopped`. Redis usa AOF/noeviction; dados sobrevivem a reinício do container. Não remover/recriar o container Redis sem preservar seu volume.

Para reiniciar todos os helpers, consultar `scripts/start-free.ps1`. O script usa as ferramentas locais já instaladas, registra PIDs em `.local`, inicia helpers ocultos e pode atualizar/publicar o gateway gratuito quando solicitado. Não instala serviços no Windows nem altera firewall ou suspensão.

## Validações reais

- Redis real: primeiras leituras concorrentes, compartilhamento, renovação, expiração de demandas, troca de liderança e rejeição de escrita antiga.
- Reinício do Redis: snapshots preservados e worker recuperado, health saudável.
- Worker Linux: imagem Docker construída e resultados oficiais com JWS ingeridos em Redis.
- Gateway: segurança de URL, preservação de resposta/headers, erros amigáveis, limite de tamanho e métodos testados.
- Site público: conferir relatórios da revisão da publicação e health.

`scripts/validate-redis.ts` aceita apenas Redis local, banco 15, para evitar modificar produção. Credenciais Vercel/Render e ferramentas locais não entram no Git.

Fontes técnicas: [Localtunnel oficial](https://github.com/localtunnel/localtunnel), [Vercel Functions](https://vercel.com/docs/functions/limitations), [Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
