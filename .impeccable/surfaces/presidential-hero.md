# Painel presidencial

Modo: Operate. Extensão do mundo editorial existente, construída diretamente em código. Escopo: hero presidencial, mapa de UFs, destaques geográficos e reações dos visitantes; inclui a relação do launcher da conversa com a leitura do hero.

## Contrato da superfície

O visitante deve identificar os cinco candidatos com mais votos disponíveis, comparar seus percentuais oficiais e explorar a liderança estadual. O hero precede a consulta de estados; no desktop o mapa acompanha o hero na coluna lateral. A identidade continua sendo folha editorial clara, Source Sans 3, regras finas, superfícies planas e números tabulares. O título direto “Os cinco mais votados” dispensa um eyebrow redundante.

O usuário autorizou barras horizontais, cores editoriais distintas por candidato, movimento nas atualizações e geometria oficial estática do IBGE. Essa ampliação pertence ao painel presidencial: não estabelece uma nova identidade global nem substitui a paleta funcional dos demais resultados. A cor identifica o candidato de forma consistente entre barras, mapa e destaques; nunca representa partido, vencedor ou situação oficial.

## Hierarquia de dados e estados

- Exibir até cinco candidatos com votos oficiais disponíveis, ordenados por votos decrescentes; em empate preservar a ordem do TSE. Não completar cinco posições com dados ausentes.
- Percentual oficial em destaque, votos ao lado da identidade, partido e número; situação apenas conforme a fonte oficial. Preservar o percentual recebido sem arredondamento adicional. Ausência não é zero.
- Antes da liberação presidencial, inclusive antes do horário configurado de 17h de Brasília, mostrar a espera explicada, sem candidatos nem reações. Mapa permanece neutro e totalização indisponível; nenhum dado fictício preenche a composição.
- Manter horários completos do TSE e do recebimento e acesso ao arquivo oficial próximos do resultado. Falha, espera, ausência e último snapshot válido conservam mensagens distintas.
- Mapa: colorir apenas liderança única por votos oficiais. Empate, zero e ausência permanecem neutros. Estado selecionado mostra nome, candidato/partido/percentual quando disponíveis, totalização e indicação de dado preservado, com link para a consulta estadual. Liderança não significa eleição definida.
- Destaques: para os dois primeiros do ranking nacional, listar até três estados e três municípios com maior percentual oficial disponível. Não ordenar por votos absolutos nem criar estimativas. Municípios são apenas os consultados e validados no painel, com cobertura parcial explícita e contagem disponível; não é um ranking nacional exaustivo. Localidades podem estar em etapas e horários diferentes; o link abre sua procedência.

## Composição e responsividade

Desktop: coluna principal com barras, procedência, destaques, diferença e feed; coluna lateral com mapa e totalização. O mapa é uma extensão de leitura do hero, não decoração. Na faixa intermediária a coluna lateral e os espaços reduzem, e os avatares cedem espaço aos nomes e números.

Até 680px: leitura em uma coluna, na ordem resultado ou espera, totalização, procedência, mapa, destaques, diferença e feed. A totalização lateral duplicada é ocultada. Destaques dos dois candidatos empilham; nomes podem quebrar linha e percentuais conservam alinhamento e legibilidade. Rank e avatares cedem espaço em telas estreitas sem retirar identidade textual.

O launcher “Conversa” entra no fluxo superior da página no mobile, após o cabeçalho, com alvo de pelo menos 44px; não cobre candidatos, reações ou procedência ao rolar. Desktop mantém o launcher flutuante. Chegada não abre formulário: sessão e cadastro da conversa começam por ativação explícita; a revisão não altera esse contrato.

## Interações e movimento

Cada UF aceita clique, foco de teclado, Enter e Espaço; seleção recebe contorno e o detalhe é anunciado de modo cortês. Nomes, percentuais e legenda textual complementam a cor. Geometria IBGE é gerada no build, com proveniência registrada em `docs/sources/geography`; todos os valores eleitorais continuam exclusivamente TSE. Não há consulta IBGE em runtime.

Barras atualizam por escala horizontal com transição de 650ms; mapa suaviza mudança de preenchimento em 500ms. Os números exibem os valores oficiais recebidos, sem contagem interpolada. `prefers-reduced-motion: reduce` remove transições e animações e restaura rolagem automática.

Likes e dislikes ficam abaixo da linha oficial, em controles independentes. Aviso explícito: são reações dos visitantes, não votos nem pesquisa eleitoral, uma escolha por navegador sem identidade verificada. Troca e remoção usam o retorno do servidor; não incrementar contadores otimisticamente. Estado pressionado, bloqueio enquanto salva e mensagem de sucesso/falha tornam a ação verificável. Indisponibilidade das reações não redefine o resultado eleitoral.

## Barra de qualidade

Leitura imediata de nome, percentual e votos; procedência visível; contraste legível; foco perceptível; controles principais de pelo menos 44px; ausência de overflow e de sobreposição do launcher no iPhone; cor sempre acompanhada de texto. Espera deve ser tão honesta quanto o resultado. Mapa, ranking e destaques não podem sugerir vencedor por inferência.

Contrato verificado em fonte em `presidential-hero.tsx`, `results-live.tsx`, `layout.tsx`, `globals.css`, `features/president/model.ts`, `chat-panel.tsx` e `docs/INTERACTIVITY.md`. A revisão visual e funcional do implementador/revisor é registrada na nota de handoff; esta documentação não constitui nova certificação de produção.
