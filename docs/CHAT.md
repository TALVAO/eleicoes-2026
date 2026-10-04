# Conversa dos visitantes

O chat é independente do pipeline eleitoral. Nenhuma mensagem, apelido ou localidade autodeclarada participa de resultados, indicadores de apuração ou declarações de eleito. Os resultados continuam exclusivamente provenientes do TSE.

## Experiência

O site abre diretamente nos resultados, sem formulário automático nem consultas ao chat. O botão “Conversa” abre o chat; visitantes sem sessão preenchem apelido, estado (ou Exterior) e cidade/localidade nesse momento. “Agora não” permite ler a conversa sem participar. Estados e cidades disponíveis vêm do catálogo EA12 já validado; o servidor confere a combinação antes de aceitar o cadastro. A localização é informada pelo visitante, não é geolocalização nem comprovação de residência.

O botão só aceita interação após a hidratação, evitando perder cliques antes do carregamento do JavaScript. O fluxo sob demanda foi testado em desktop e iPhone: nenhuma consulta ao chat na chegada, cadastro após clique e entrada direta para sessão existente.

O painel abre abaixo dos resultados. Um botão compacto permite abrir/recolher. A conversa só consulta sua API enquanto aberta e com a aba visível: intervalo de 5 segundos, sem requisições simultâneas, timeout, ETag/304 e reconexão ao recuperar rede/visibilidade. Nenhuma consulta adicional é feita ao TSE.

## Persistência e limites

- Redis compartilhado, namespace `ele2026:chat:` separado do cache eleitoral; requer `REDIS_URL` ou `CHAT_REDIS_URL`. Sem Redis, retorna indisponibilidade e os resultados continuam operando.
- Sessão de 24 horas com token aleatório de 256 bits. Somente o hash fica no Redis; cookie HttpOnly, SameSite=Strict e Secure em HTTPS. Identidade do autor é montada pelo servidor, nunca aceita do corpo de envio.
- Texto de até 280 caracteres. Rejeita HTML, links reconhecidos, caracteres de controle e controle bidirecional. React apresenta texto escapado. O filtro de links é básico, não detecta toda ofuscação.
- Intervalo mínimo de 5 segundos, repetição bloqueada por 60 segundos; 10 envios/minuto por participante, 20 por conexão e 120 globais. Contadores e inserção/cooldown usam Lua atômico no Redis.
- 5 novos cadastros/hora por conexão; 10 denúncias/hora por conexão. Uma pessoa denuncia cada mensagem uma vez até que a moderação dispense as denúncias.
- Até 100 mensagens recentes exibidas; índice limita 500 entradas. Mensagens, metadados e denúncias expiram após 24 horas; chaves de entradas removidas do índice também possuem TTL. Sessão e perfil também expiram em 24 horas. Bloqueios duram 7 dias. Redis AOF pode reter histórico operacional até sua compactação; a política descreve disponibilidade na aplicação, não eliminação física imediata de backups.
- Ocultar participante afeta apenas este navegador; armazena até 100 identificadores públicos em localStorage. Denúncias não removem automaticamente conteúdo: a revisão é manual.

## Moderação

Abra `/chat/moderacao` e use `CHAT_ADMIN_TOKEN`, segredo exclusivo do servidor com pelo menos 32 caracteres. O formulário mantém a chave somente na memória da página; ela não vai em URL nem localStorage. Há ações para remover mensagem, bloquear participante/conexão e dispensar denúncias. Bloquear remove a mensagem selecionada e impede novos envios/cadastros pela conexão por 7 dias; outras mensagens anteriores precisam ser removidas separadamente. Redes compartilhadas podem ter outros participantes afetados. Apelidos não são exclusivos e não equivalem a contas autenticadas.

No perfil gratuito, `scripts/start-free.ps1` cria uma chave aleatória em `.local/free/chat-admin-token.txt` e injeta no processo Next. Para consultar **localmente**, sem enviar o segredo pelo chat ou publicar em repositórios:

```powershell
Get-Content .\.local\free\chat-admin-token.txt
```

Para rotacionar, substituir esse arquivo por um novo segredo forte e reiniciar o servidor. Nunca use a chave do gateway como chave de moderação.

Não existe moderação automática de conteúdo político nem equipe de revisão fornecida pelo software. O responsável pelo site precisa acompanhar denúncias e atuar. Uma pessoa determinada pode trocar conexão/navegador; limites reduzem abuso, não comprovam identidade.

## Gateway e segurança

O gateway gratuito autoriza escrita apenas nas quatro rotas exatas `/api/chat/session`, `/api/chat/messages`, `/api/chat/reports` e `/api/chat/moderation`. Aceita JSON de até 4 KiB. Origin deve corresponder exatamente a `SITE_URL`. Cookies são repassados só ao chat; a chave administrativa só à rota de moderação. Não foi habilitada escrita genérica em outras APIs.

A Vercel sobrescreve `X-Forwarded-For`, segundo sua [documentação oficial de headers](https://vercel.com/docs/headers/request-headers). O gateway transforma o IP em HMAC com segredo privado e sobrescreve qualquer identidade enviada pelo visitante. O servidor aceita essa identidade apenas atrás do gateway autenticado; não persiste o IP bruto no chat. Na execução direta/local, utiliza um único limite conservador, ignorando headers de IP não confiáveis. Em outro proxy de produção, implementar um adaptador confiável antes de aumentar os limites.

## Verificação

Testes unitários cobrem schemas, Origin, tamanho de corpo, sessões/cookies, chave de moderação e identidade da conexão. Com `CHAT_TEST_REDIS_URL` apontando somente para loopback/DB 14 ou 15, testes adicionais exercitam o Redis real: concorrência atômica, TTL, denúncia duplicada, bloqueio e renovação de cadastro.

Playwright usa banco 14 isolado e dados eleitorais oficiais de teste no cache separado `.data-e2e`; testa primeira visita, acessibilidade, identificação, dois participantes, publicação, denúncia/remoção, persistência após recarga, pausa do polling e erros. `scripts/reset-chat-e2e.ts` limpa exclusivamente o namespace do chat de testes no DB 14; o DB 0 de produção não é tocado. CI provisiona apenas um Redis temporário para essas validações.

Validação em 04/10/2026: lint, typecheck e build de produção com Webpack passaram; 88 testes unitários (incluindo Redis real) passaram; suíte completa com 30 E2E passou, incluindo login e saída da moderação, cadastro, conversa e apuração em desktop/iPhone Chromium. O formulário administrativo só habilita entrada após hidratação, evitando perder a chave digitada antes do JavaScript estar pronto. URL pública verificada em desktop/iPhone Chromium: cadastro inicial, saída visível para resultados, acessibilidade AA, ausência de overflow/erros client-side, POST permitido, cookie HttpOnly, envio anônimo negado e moderação sem chave negada. Nenhuma mensagem de teste foi publicada no chat de produção. Safari físico e capacidade para grande audiência não foram homologados.

O painel publicado também foi verificado com a chave local real: leitura autenticada aprovada, acessibilidade AA sem violações detectadas e saída limpando a chave da memória do formulário. Segredos e ferramentas de verificação permanecem em `.local`, ignorado pelo Git. Os scripts de operação agora distinguem Docker Desktop indisponível de container ausente e não confirmam parada de containers quando o Docker falha.
