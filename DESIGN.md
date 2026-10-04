---
name: Eleições 2026
description: Consulta editorial clara de resultados oficiais, com procedência e frescor visíveis.
colors:
  paper: '#f7f8f6'
  surface: '#fff'
  ink: '#192824'
  muted: '#596861'
  line: '#dce2dd'
  accent: '#24594a'
  tint: '#edf2ee'
  warn: '#73521c'
  focus: '#458a70'
typography:
  display:
    fontFamily: "'Source Sans 3 Variable', sans-serif"
    fontSize: '36px'
    fontWeight: 580
    lineHeight: 1.09
    letterSpacing: '-.025em'
  headline:
    fontFamily: "'Source Sans 3 Variable', sans-serif"
    fontSize: '32px'
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: '-.025em'
  title:
    fontFamily: "'Source Sans 3 Variable', sans-serif"
    fontSize: '18px'
    fontWeight: 650
  body:
    fontFamily: "'Source Sans 3 Variable', sans-serif"
    fontSize: '16px'
    lineHeight: 1.5
  label:
    fontFamily: "'Source Sans 3 Variable', sans-serif"
    fontSize: '11px'
    fontWeight: 650
    letterSpacing: '.045em'
  metric:
    fontFamily: "'Source Sans 3 Variable', sans-serif"
    fontSize: '56px'
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: '-.035em'
rounded:
  surface: '12px'
  notice: '8px'
  control: '6px'
  circle: '50%'
spacing:
  inline: '8px'
  row: '16px'
  field-gap: '20px'
  section: '24px'
  panel: '28px'
  block: '32px'
  columns: '40px'
  spacious: '44px'
components:
  button-retry:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.surface}'
    rounded: '{rounded.control}'
    padding: '12px 18px'
  text-link:
    textColor: '{colors.accent}'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '10px 12px'
  navigation:
    textColor: '{colors.muted}'
    padding: '19px 2px'
  navigation-active:
    textColor: '{colors.accent}'
  office-chip:
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '11px 15px'
  office-chip-active:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.surface}'
  waiting-panel:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.surface}'
    padding: '44px'
  totalization:
    backgroundColor: '{colors.tint}'
    textColor: '{colors.ink}'
    rounded: '{rounded.surface}'
    padding: '28px'
---

# Design System: Eleições 2026

## Overview

**Creative North Star: "Folha editorial de apuração"**

A interface implementa a direção editorial financeira clara fixada pelo usuário: uma folha de leitura com superfícies brancas, regras finas e verde petróleo funcional. A hierarquia nasce da tipografia, do espaço e dos números alinhados; a cor conduz estados e navegação sem acrescentar decoração partidária.

Source Sans 3 reúne títulos, textos e métricas numa única voz. A densidade aumenta quando os dados oficiais existem. Na ausência de publicação, a mesma linguagem apresenta uma espera legível, com explicação e procedência, sem criar candidatos ou números para preencher espaço. A identificação de dados oficiais convive com a declaração de que o site é independente do TSE.

**Key Characteristics:**

- Leitura editorial clara, com informação e procedência em primeiro plano.
- Superfícies planas, regras finas e contraste de tinta sobre papel.
- Uma família tipográfica variável e números tabulares.
- Verde petróleo funcional, com aviso em ocre discreto.
- Resultados e totalização legíveis em telas pequenas.

## Colors

A paleta combina papel quase branco, tinta verde escura e um único acento verde petróleo; o ocre distingue degradação.

### Primary

- **Verde petróleo funcional** (`accent`): links, seleção da navegação, indicadores de conexão, progresso e barras de votos.

### Neutral

- **Papel claro** (`paper`): plano de fundo contínuo da página.
- **Folha branca** (`surface`): cabeçalho, painel de espera e campos.
- **Tinta profunda** (`ink`): títulos, números e cargo selecionado.
- **Texto secundário** (`muted`): instruções, horários, legendas e links de navegação inativos.
- **Regra editorial** (`line`): divisores, limites de campos e linhas de listas.
- **Papel verde suave** (`tint`): totalização, marcador de situação oficial e pequenos identificadores.

### Named Rules

**The Functional Color Rule.** Use o acento para orientação, fonte e estado. Preserve a neutralidade visual solicitada; não atribua grandes blocos de cores partidárias aos candidatos.

`warn` identifica o estado de conexão degradada. O aviso usa ainda fundo ocre claro e texto ocre escuro definidos no componente. `focus` reserva um contorno visível para navegação por teclado.

## Typography

**Display Font:** Source Sans 3 Variable, com fallback sans-serif.

**Body Font:** Source Sans 3 Variable, com fallback sans-serif.

**Character:** Uma sans humanista de leitura direta. Pesos intermediários, títulos compactos e números tabulares produzem clareza sem aparência promocional.

### Hierarchy

- **Display:** o título de espera usa a função `display`; no mobile passa a (32px). O título da página explicativa usa (42px), reduzindo a (34px) no mobile.
- **Headline:** o título principal usa a função `headline`; reduz a (29px) até a faixa intermediária e a (28px) no mobile.
- **Title:** totalização e feed usam a função `title`. Comparação e localidades usam (25px, peso 600); nomes de candidatos usam (18px, peso 650), reduzindo a (16px).
- **Body:** a base usa a função `body`. O texto de espera amplia a (17px, entrelinha 1.55), voltando a (16px) no mobile. Textos explicativos longos chegam a (70ch).
- **Label:** o estado de conexão usa a função `label`, em caixa alta; no mobile reduz a (10px). Metadados usam (11–13px). Cabeçalhos de resultados usam (10px) e espaçamento entre letras (.07em).
- **Metric:** a totalização usa a função `metric`, reduzindo a (52px) no mobile. O percentual de candidato usa (31px, peso 600) no desktop e (29px) no mobile.

**The Stable Numbers Rule.** Votos, percentuais, horários e diferenças usam números tabulares para manter o alinhamento durante atualizações. Preserve a formatação brasileira e a indicação de ausência.

## Layout

O conteúdo e o cabeçalho alinham numa largura máxima de (1184px). O container usa a largura disponível menos (64px), com respiro vertical de (44px) no topo e (68px) no final. O cabeçalho tem (92px) de altura; a navegação horizontal ocupa sua própria faixa.

O resultado organiza uma coluna flexível e uma coluna de totalização de (304px), com intervalo de (40px). Até (900px), a coluna lateral passa a (264px) e o intervalo a (28px); a lista de estados passa de duas colunas a uma.

Até (680px), as margens laterais passam a (20px), o cabeçalho a (72px) e o conteúdo a uma coluna. Resultados ou espera aparecem primeiro, totalização em seguida, depois horários, diferença e feed. A explicação lateral é ocultada; a fonte permanece no painel. Campos passam a uma coluna, enquanto a navegação conserva seus quatro destinos. A comparação mantém três colunas, com duas colunas numéricas de (72px). A partir de (1600px), o topo ganha (54px) e a espera pode ocupar (430px) de altura mínima.

A escala de espaço vem de usos reais: intervalos pequenos para ícone e texto, linhas com (16px), campos com (20px), grupos com (24–32px) e separação entre colunas com (40px). Preserve alvos táteis de pelo menos (44px) nos links e seletores principais.

## Elevation & Depth

O sistema não usa sombras. Profundidade vem da folha branca sobre papel claro, do tom verde suave da totalização e de regras finas entre registros. Não há gradientes ou efeitos de vidro na implementação.

**The Flat Surface Rule.** Mantenha painéis planos. Diferencie função por tom, espaço e divisor, preservando a hierarquia existente.

## Shapes

Os grandes painéis usam o raio `surface`. Campos, cargos e o botão de recuperação usam `control`; avisos usam `notice`. Avatares, ícones de espera e pontos de status são circulares. As linhas de candidatos e estados ficam abertas, com divisores inferiores em vez de caixas individuais.

Barras de voto são finas (4px), com cantos de (2px); o progresso de totalização usa (5px), com cantos de (3px). Identificadores de UF usam (36px) quadrados com cantos de (5px). Ícones de traço reforçam função e mantêm baixo peso visual.

## Components

### Buttons

O botão implementado é a ação de recuperação da página de erro. Usa o acento, texto branco, raio `control` e espaçamento do token `button-retry`. A implementação não define uma cor de hover específica; conserve o foco global visível. Não há uma família de botões promocionais.

### Links

Links editoriais usam acento, peso (600), texto de (14px), altura mínima de (44px) e ícone pequeno quando há destino externo. Links de procedência, marca e rodapé também preservam uma altura mínima de (44px). Hover acrescenta sublinhado. O link de salto fica fora da tela até receber foco.

### Chips

O seletor de cargo usa links com borda fina e raio `control`. O cargo ativo usa tinta profunda e texto branco, com `aria-current`. Hover muda a borda para acento; o foco usa o contorno global. Situação de candidato usa um pequeno marcador de fundo `tint`, exibido somente quando existe situação oficial.

### Cards / Containers

A espera usa uma folha branca ampla, raio `surface`, ícone circular e título de leitura imediata. Tem altura mínima de (382px) no desktop e (360px) no mobile. A totalização usa `tint`, mesma família de cantos, grande métrica quando disponível e explicação de espera quando ausente. Não substitua indisponibilidade por zero.

### Inputs / Fields

Campos e selects usam fundo branco, borda `line`, raio `control`, texto de (15px) e altura mínima de (46px). Labels usam texto secundário de (13px), peso (600), associados ao campo por identificador. Cada campo ocupa um grupo próprio na linha flexível. A busca reserva espaço à esquerda para o ícone. Desabilitado usa fundo cinza esverdeado, texto secundário e cursor de indisponibilidade. Todo campo conserva label visível e foco global de (3px) com deslocamento de (4px).

### Navigation

A navegação de abrangência usa texto secundário, ícones de traço e linha inferior de seleção em acento (2px). O estado ativo é identificado por `aria-current`; hover aproxima o texto da tinta principal. No mobile, os quatro destinos dividem a faixa disponível e os textos reduzem a (13px).

### Result rows and provenance

Linhas de candidato alinham avatar, nome/partido/situação, barra de votos e percentual à direita. O avatar usa imagem oficial quando disponível e ícone neutro em falha. Divisores organizam a lista; as barras compartilham a cor funcional. Não use a cor como atalho para atribuir partido ou vencedor.

Data e horário completos do TSE, data e horário completos de recebimento e acesso ao arquivo oficial formam uma faixa compacta e flexível. Esses metadados usam o fuso de Brasília e podem quebrar linha para preservar a leitura no mobile. O feed usa linhas de horário e descrição. Avisos de falha preservam texto explícito e ícone; a cor sozinha não informa o problema.

As barras de voto adotam imediatamente o valor recebido, sem animar sua largura. A implementação não define transições ou animações específicas. O modo de movimento reduzido desativa transições e animações e restaura rolagem automática.

## Do's and Don'ts

### Do:

- **Do** alinhar títulos, resultados e metadados ao mesmo container editorial.
- **Do** preservar contraste, labels visíveis, foco de teclado e alvos táteis de pelo menos 44px nos controles principais.
- **Do** usar números tabulares para resultados e horários.
- **Do** distinguir ausência, zero oficial, espera e falha com texto explícito.
- **Do** apresentar a totalização logo após os resultados no mobile.
- **Do** manter procedência e horários próximos aos dados.

### Don't:

- **Don't** preencher espera com candidatos, votos ou percentuais inventados.
- **Don't** comunicar eleito ou situação de candidato por inferência visual.
- **Don't** substituir o sistema plano por sombras, gradientes ou efeitos de vidro.
- **Don't** ampliar cores partidárias a ponto de dominar a leitura.
- **Don't** sugerir vínculo institucional com o TSE no cabeçalho ou na identidade.
