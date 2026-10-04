# Exterior: representação oficial de 2026

## Identificação

Arquivo encontrado: [EA12 federal](https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json). Em `abr`, a entrada tem `ds=EXTERIOR` e `cd=zz`. `TSEExteriorAdapter` procura o nome descritivo oficial, verifica unicidade/código e cruza a abrangência com EA11. O documento EA16 de 22/05/2026 também confirma a representação observada `zz`. O runtime não exige essa literal: uma mudança oficial de código é seguida pela configuração, com validação de abrangência e cruzamento EA16; identidade ambígua é rejeitada.

`mu[]` representa localidades do Exterior, com `cd` de cinco posições, `nm` e `z[]` de zonas. Não representa uma tabela de países. As localidades são exibidas como localidades, com nomes oficiais. O identificador `29254`, por exemplo, corresponde a ABIDJÃ na captura; esse nome/código não é inserido na UI por constante.

## Arquivos encontrados

| Arquivo                       | URL observada                                                                                                                                                                               | Campos utilizados                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Configuração eleitoral        | [EA11](https://resultados.tse.jus.br/oficial/comum/config/ele-c.json)                                                                                                                       | `pl`, `e`, `abr`, `arq`                                          |
| Localidades                   | [EA12](https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json)                                                                                                       | `abr.cd/ds`, `mu.cd/nm/z`                                        |
| Consolidado presidencial      | [EA20 JSON](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/zz/zz-c0001-e006257-u.json), [JWS](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/zz/zz-c0001-e006257-u.jws) | `tpabr=uf`, `cdabr=zz`, candidatos, `s,e,v`, `and,dv,dg,hg`      |
| Acompanhamento de localidades | [EA15](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/zz/zz-e006257-ab.json)                                                                                                      | `abr.tpabr=mun`, `cdabr,dt,ht,and`                               |
| Localidade ABIDJÃ             | [EA20](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/zz/zz29254-c0001-e006257-u.json)                                                                                            | `tpabr=mu`, `cdabr=29254`, mesmos campos de resultado            |
| Zonas/seções                  | [EA16](https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3220/config/zz/zz-p003220-cs.json)                                                                                        | `cdp`, `abr.cd/ds`, `mu.cd/nm`, `zon.cd`, `sec.ns/nsp/nsa/da/ha` |

A ingestão utiliza `.jws` para EA20 e EA15. O JSON foi capturado para documentar estruturas. Diretórios são gerados pelos templates de EA11, não pelo teste de diferentes combinações.

## Modelo padronizado

- Consolidado: `Result` com scope descoberto, cargo presidencial e `municipality=null`.
- Localidade: mesmo modelo com código oficial em `municipality`.
- Seções: `ExteriorSections.localities[].zones[].sections[]`; preserva principal e agregadas, sem somar seções para recompor totalização.
- País: `countryBreakdown()` retorna `null`, porque não há vínculo oficial de país nos recursos encontrados.

Foi observada zona `0001` nas localidades da configuração. Esse valor é exibido a partir de EA16; não é imposto ao construir cadastro ou resultados.

## Disponibilidade

Disponível estruturalmente: consolidado presidencial, resultado por localidade, votos/percentuais publicados, comparecimento, abstenção e totalização quando liberados; cadastro de zonas/seções. Na captura pré-17h os arquivos de resultado estavam em preparação. A interface aguarda e não apresenta seus zeros como votos apurados.

Não disponível nos arquivos consumidos: distribuição por país; vínculo país-localidade; interpretação geográfica de nomes; voto por seção derivado do cadastro; tempo real de chegada de BU sem auxiliar real validado. A tela explica a ausência de países e oferece apenas detalhe por localidade que EA12/EA20 suportam.

Quando não existe EA20 válido de uma localidade, a UI apresenta indisponibilidade, preserva o último válido se houver e aplica backoff. Cadastro não implica resultado publicado. Fotos são baixadas pelo mesmo worker somente da fonte oficial e servidas do cache.

## Comparação

Brasil EA20 inclui Exterior. O card compara os dois percentuais oficiais diretamente, sem subtração nem aproximação de um “Brasil doméstico”. Selecionar uma localidade não troca o lado Exterior da comparação: ele continua consolidado. As datas/horas de geração de cada abrangência ficam visíveis; arquivos podem ter gerações diferentes.

## Limitações de investigação

EA11, EA12, EA20 Brasil/Exterior/localidade, EA14, EA15 e EA16 reais foram obtidos. JWS reais de Brasil/Exterior/EA14 foram verificados em testes; EA15 JWS é validado quando ingerido. EA18 PDF não pôde ser extraído por timeout, e EA16 preparatório não indicava auxiliar real disponível. Nenhum schema auxiliar ou país foi inventado para preencher essa lacuna.
