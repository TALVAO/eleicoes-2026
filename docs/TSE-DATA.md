# Dados oficiais e evidências

Verificação realizada em 04/10/2026, antes das 17h de Brasília. Capturas preservam o conteúdo oficial; votos preparatórios não são resultados divulgados.

## Documentação consultada

O [índice oficial 2026](https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados) referencia EA10/11/12/14/15/16/18/20, download e JWS. Foram lidos os documentos acessíveis e os JSONs reais abaixo. EA20 10/07/2026 e EA16 22/05/2026 foram extraídos com sucesso na revisão final. EA15 PDF retornou conteúdo não extraível; utilizamos a estrutura real e o FAQ oficial. EA18 PDF retornou timeout; não foi criado parser especulativo. Versões anteriores oficiais foram consultadas como complemento durante a pesquisa, sem substituir os arquivos reais de 2026.

O [FAQ técnico oficial](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados) confirma que não há EA10 presidencial específico, que 304 conta no limite e que EA14/15 são indicadores sujeitos a diferenças de propagação na CDN. Nenhum frontend jornalístico foi usado para engenharia reversa.

## Arquivos efetivamente obtidos

Prefixo atual observado: `https://resultados.tse.jus.br/oficial/ele2026/`. O runtime descobre diretórios EA11; esta tabela documenta os caminhos da captura, não define os códigos de produção.

| Recurso         | Caminho observado                                               | Evidência local                   |
| --------------- | --------------------------------------------------------------- | --------------------------------- |
| EA11            | `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json` | `sources/ele-c.json`              |
| EA12 federal    | `6257/config/mun-e006257-cm.json`                               | `sources/EA12.json`               |
| EA14            | `6257/dados/br/br-e006257-ab.json` e `.jws`                     | `EA14.json`, `EA14-JWS.jws`       |
| EA15 Exterior   | `6257/dados/zz/zz-e006257-ab.json`                              | `EA15-ZZ.json`                    |
| EA20 Brasil     | `6257/dados/br/br-c0001-e006257-u.json` e `.jws`                | `EA20-BR.json`, `EA20-BR-JWS.jws` |
| EA20 Exterior   | `6257/dados/zz/zz-c0001-e006257-u.json` e `.jws`                | `EA20-ZZ.json`, `EA20-ZZ-JWS.jws` |
| EA20 localidade | `6257/dados/zz/zz29254-c0001-e006257-u.json`                    | `EA20-LOCAL.json`                 |
| EA16 Exterior   | `arquivo-urna/3220/config/zz/zz-p003220-cs.json`                | `EA16-ZZ.json`                    |

O worker consultou também EA12 estadual/Conselho e EA20 das UFs. Resultados e indicadores em produção utilizam a extensão **`.jws`**, verificada, não os JSONs documentais como fallback.

## Descoberta da eleição

EA11: raiz `dg,hg,idg,f`, `arq[{tp,dir}]`, `pl[{cd,cdpr,c,dt,dtlim,e[]}]`. Eleições têm `cd,cdt2,nm,t,tp,abr[].cp[]`; cargos têm `cd,ds,tp`. Para `dt=04/10/2026`, `t=1`, foi observado pleito `3220`, ciclo `ele2026`, federal `6257`, estadual `6259`, Conselho `6261`. Códigos de segundo turno existentes em EA11 não são usados automaticamente neste primeiro turno.

Tipos de diretório utilizados: `cm` configuração, `u` resultado, `ab` acompanhamento, `ft` foto e `cs` cadastro de seções. O tipo `aux` é identificado, mas não consumido sem documento/amostra validada.

EA12: `abr[{cd,ds,mu[{cd,cdi,nm,c,z[]}]}]`. `mu.cd` tem cinco posições; `cdi` não é utilizado para URLs. Na captura, `cdi` doméstico tinha sete posições e no Exterior era vazio. Zonas `z` são strings de quatro posições. Preservamos exatamente os códigos eleitorais, sem converter para códigos IBGE.

## Modelo de resultado

EA20 validado: `ele,t,f,tpabr,cdabr,dg,hg,idg,dt,ht,and,dv`, `carg[].agr[].par[].cand[]`, `s,e,v`. Valores numéricos são strings; ausências opcionais viram `null`. `f=o` é obrigatório. Campos desconhecidos não chegam à UI; alterações de campos utilizados causam erro de schema.

| Dado interno                                   | Campo oficial                               |
| ---------------------------------------------- | ------------------------------------------- |
| Identidade / nome / partido / número / ordem   | `sqcand,nmu` ou `nm`, `par.sg,n,seq`        |
| Votos / percentual                             | `vap,pvap` (não recalculado)                |
| Situação                                       | `st`, com interpretação conservadora de `e` |
| Seções / totalizadas / pendentes / percentual  | `s.ts,s.st,s.snt,s.pst`                     |
| Votos totais / válidos / brancos / total nulos | `v.tv,v.vv,v.vb,v.tvn`                      |
| Comparecimento / abstenção                     | `e.c,e.a`                                   |
| Geração / totalização                          | `dg+hg`, `dt+ht`, Brasília                  |
| Definição matemática / sem eleito              | raiz `md`, `esae`                           |

`and=n` ou `dv=n` impede exibição como resultado. `and=p/f` distingue parcial/finalizado; finalizado não é sinônimo de candidato eleito. `md` aceita `e/s/n`. `e=s` de candidato também pode significar segundo turno; somente situação oficial correspondente autoriza marcar eleito. `pvap` é o percentual fornecido pelo TSE, com seu denominador oficial. Nulos usam `tvn`, incluindo técnicos, com rótulo explícito.

EA20 usa `tpabr=mu` para municípios/localidades; EA15 capturado usa `mun`. Não aplicar um enum único presumido a todos os arquivos. Resultado zonal documental usa `zona`; não há página de votos por seção construída a partir de uma soma local.

## Integridade

Manual JWS 16/09/2026, apêndice B: Ed25519, `alg=EdDSA`, `kid=sNbt9Q_fLS65zE1_ZLNV-XRRwPY`, chave pública fixada em `validation.ts`. O teste verifica JWS reais de Brasil, Exterior e EA14. Header com chave/URL não confiável é rejeitado. Não há confiança automática em chave recebida no próprio arquivo. Hash é SHA-256 do payload JSON assinado, e não do envelope JWS.

EA11/EA12/EA16 usam validação estrutural sobre TLS. O aplicativo não afirma que esses arquivos passaram por JWS quando não passaram. Verificação completa X.509/CRL não foi implementada; o caminho pela chave fixada do manual foi escolhido. Rotação inesperada degrada a ingestão até atualização auditada.

## Inventário reproduzível

`npm run check:sources` produz `docs/sources/inventory.json`, com URL e SHA-256 de cada captura. Não formate nem altere arquivos JWS/JSON capturados para simular produção. Testes sintéticos pertencem a `tests`, nunca a `src` ou `.data`.

O único cálculo eleitoral exibido é diferença de votos/pontos percentuais e mudança entre snapshots oficiais, ambos rotulados como derivados. Não há divisão por país, percentual recomposto, preenchimento de faltantes ou classificação de vencedor por algoritmo próprio.
