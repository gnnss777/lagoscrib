# ADR-004 — Telefone no schema: coletar, não assumir

Data: 2026-09-27. Status: aceita (lane `oc/telefone`, commit `13c5c532`).
Supersede: **ADR-001 §5**.

## Contexto

ADR-001 §5 decidiu: *"Contato sempre pelo `link` do anúncio original (banco de
links). Telefone/e-mail mascarados nos portais => campos vazios, UI esconde os
botões."*

Essa decisão produziu 64 imóveis com `phone: ""` e dois testes que **asseguravam**
o vazio (`s001-data.test.ts`, `expansao-base.test.ts` — o segundo se chamava
`test_expansao_sem_telefone_email`). Nenhum dado de telefone existia em lugar
nenhum: nem nos JSON de coleta, nem no banco.

A premissa da §5 — "os portais mascaram" — é **factualmente errada**, e o motivo
exato é diferente em cada portal.

## Decisão

1. **`phone` é campo obrigatório do schema.** Vazio significa "não publicado",
   nunca "não TRY harder".
2. **A coleta do telefone é responsabilidade do coletor**, com duas
   implementações, porque o comportamento difere por portal:

   | Portal | Mecanismo | Custo |
   | --- | --- | --- |
   | **Apolar** | Campo `lojacelular`/`lojatelefone` da API de busca | Zero. API pública, sem browser |
   | **Zap / VivaReal** | Nome da imobiliária + CRECI no card do anúncio (sem clique), depois o celular no **site da imobiliária** | Zero. Nem clique, nem lead, nem dado pessoal |
   | Zap / VivaReal (anúncios com formulário) | Exige Nome/Telefone/E-mail do visitante + aceite de Termos | Existe, mas **não é a rota** |
   | **OLX** | — | Links de `data/coleta/olx.json` estão mortos ("Anúncio não encontrado") |
   | **E-mail** | — | Nenhum dos 4 portais publica e-mail do anunciante. Segue vazio por decisão |

3. **A rota escolhida é o site da imobiliária, não o formulário de lead.** O
   formulário manda dados pessoais do dono para cada anunciante e registra lead
   no painel deles. O site da imobiliária é onde ela publica o contato **de
   propósito**, para o inquilino ligar. Zero clique, zero lead, zero dado
   pessoal. Ver §4.

4. **Como a rota do site funciona** (verificado 27/09/2026):
   - A página de detalhe do Zap/VivaReal entrega **nome da imobiliária, id do
     anunciante e CRECI no DOM antes de qualquer interação** — `a[href*="/imobiliaria/"]`
     e o texto "CRECI: 00137-J-PR". Zap e VivaReal compartilham o espaço de ids
     (52572 = Gonzaga nos dois), então os 39 anúncios colapsam em **28
     anunciantes** e um número resolve vários anúncios.
   - Precisa de browser: a página é renderizada por JS e `fetch` puro devolve
     **zero** identificações. Erro que já foi cometido uma vez.
   - Cada anunciante é pesquisado no site **dele**, conferindo o CRECI do site
     contra o CRECI do anúncio. Existe 3 "Gonzaga Imóveis" no Brasil, várias
     "Rezende" e uma "Favretto" com CRECI diferente — **o CRECI é o que separa**.
   - Fica o **celular de locação, DDD 41**. Quando o site rotula (Cadena, Ivan
     Freitas, Innova, Basi, Cesário Pereira, Atria, Imobiliária X), o rótulo
     decide.
   - **Prefixo mascarado do portal como conferência**: o portal mostra
     `(41) 3xxx-` e o site publica um número que começa com esse prefixo. Bateu
     em quase todos. A única exceção não resolvida por CRECI foi Gonzaga, que
     também é o único caso de empresa com dois CRECIs e dois sites.

5. **Cobertura zero na leva = alerta, não erro.** A leva não aborta, mas
   `manifesto.py` e o final de `coleta.mjs` avisam. Silêncio é o que escondeu
   esse problema por meses (postmortem `imovel-scraper` ERRO-2: *"falha
   silenciosa é pior que erro"*).

6. **Validação barrou dois "celulares" que eram fixo.** Basi "41 9574-0407" e
   Nakayoshi "41 9996-0927": 8 dígitos, celular brasileiro tem 9. Número errado
   num app de aluguel é pior que número ausente, então ficam fora e registrados
   no log com o motivo.

7. **Sete anunciantes recusados em vez de chutados**, cada um com o motivo:
   Gonzaga (resolvido depois: só tem fixo), Hoje (só 0800 toll-free), ReMax
   Kmk10 e ReMax Share (site renderizado por JS), Rezende (CRECI divergente),
   Daniel Correa e M E D (sem site).

## Consequências

- **41 dos 64 imóveis têm telefone, todos celulares DDD 41** (64% de cobertura):
  - 25 do Apolar, sem browser e sem clique, todos da imobiliária Locação Centro
    (`+5541991210624`) — o mesmo número, porque os 25 anúncios do Apolar na base
    são todos dessa empresa
  - 16 de 14 imobiliárias, do site de cada uma
- **16 imóveis seguem sem telefone mas têm fixo publicado** no site da
  imobiliária: Gonzaga 4, Jamaica 3, 2000 3, Paraíso 2, Galo 1, Especiale 1,
  Basi 1, Nakayoshi 1. Ficam de fora do `phone` porque o requisito é celular. O
  número está em `data/coleta/imobiliarias-aplicado.json`, pronto para entrar
  se o requisito mudar.
- **6 anunciantes sem solução**: Hoje (só 0800 toll-free), ReMax Kmk10 e ReMax
  Share (site renderizado por JS, telefone não legível), Rezende (o único de
  Curitiba é CRECI 56940J, não 22256-J), Daniel Correa e Imobiliária M E D (sem
  site). Mais 1 link morto (VivaReal 404).
- `phone` no `lib/data.ts` é **público no bundle**. O repo é público
  (`gnnss777/lagoscrib`) e o context pack do projeto registra que o dono já
  aceitou exposição de telefone. Consequência: a promessa de
  `app/privacidade/page.tsx` ("exibimos o telefone somente em horário
  comercial") **não é mais verdade** e foi corrigida nesta leva.
- O telefone é da **imobiliária anunciante**, não de pessoa. No Apolar isso é
  explícito: o mesmo celular em todos os anúncios de uma loja.

## Gonzaga: uma empresa, dois CRECIs, dois sites

O único conflito que travou a resolução inicial, e a explicação é simples:

| Site | CRECI | Negócio | Telefone |
| --- | --- | --- | --- |
| `gonzagaimoveis.com.br` | J04861 | **locação** (anúncios de R$ 620 a 3.700, todos "para locação") | (41) 3013-2222 |
| `gonzagahome.com.br` | J00137 | **venda** (imóveis de R$ 458 mil a 5,9 milhões) | (41) 3014-1010 |

Os anúncios da base são de aluguel, então a linha é a do site de locação. O
prefixo mascarado do portal é `(41) 3013-`, que bate com o `3013-2222`. A empresa
opera os dois registros CRECI, por isso o anúncio carrega `00137` e o site de
locação declara `04861`. **Nenhum dos dois publica celular** — Gonzaga fica na
lista de "só fixo".

## Alternativas rejeitadas

- **Formulário de lead do portal**: rejeitado por decisão do dono. Envia Nome,
  Telefone e E-mail dele para cada anunciante, com aceite de Termos, e cada
  envio aparece como lead no painel da imobiliária. O site da imobiliária entrega
  o mesmo contato sem nenhum dos três custos. O código do formulário ficou no
  repo atrás de `LEAD_ENABLED` + `LEAD_*` no env (opt-in duplo, com teste) caso
  o formato de algum anúncio só exista lá.
- **Interceptar XHR em vez de clicar**: desnecessário. O clique de qualquer forma
  registra lead, e o site da imobiliária é a fonte melhor.
- **Normalizar para `(41) 99699-0773`**: `maskPhone` e `buildWhatsAppLink` já
  sabem lidar com `+55…`. Normalizar seria reescrever algo certo.
- **Preencher o telefone com fixo quando não há celular**: 16 imóveis ficariam
  cobertos, mas o requisito do dono é celular DDD 41. Os fixos ficaram
  registrados em `data/coleta/imobiliarias-aplicado.json` para virar decisão
  separada.
- **Implementar `PropertyContact` do Prisma**: a tabela existe
  (`schema.prisma`, com `phone String?`) e `app/api/contact/[id]` a lê, mas
  **nenhum código cria registro** — o endpoint sempre retorna 404. Como o
  telefone agora vive no `lib/data.ts` estático, um writer a mais sem
  consumidor real é custo sem retorno. Fica para quando existir multiusuário
  de verdade.

## Por que o `phone` vazio passou tanto tempo

Quatro camadas independentes, e bastava uma para travar:

1. O coletor não extraía telefone (Zap/VivaReal) ou jogava fora o que a API
   entregava (Apolar).
2. `generate.py:58` escrevia `phone: ""` como **literal** — apagava o dado mesmo
   com ele presente no JSON.
3. Dois testes afirmavam `phone === ""`, convertendo acidente em invariante.
4. A UI escondia a ausência com elegância ("Telefone não informado"), então
   nada parecia quebrado.

## ADR Dependencies

- **Supersede ADR-001 §5** (a cláusula de contato). ADR-001 §1-§4 continuam
  válidas: `lib/data.ts` como fonte de verdade, leva curada em PR,
  browser real com delay, e `condoUnknown` sem estimativa.
- ADR-002 (UI de confiança) é afetada: passa a haver botão de telefone
  exibível. Nenhuma mudança de layout necessária.

## Engine Compatibility

Next.js 16 (App Router) · domínio Data · risk LOW — nenhum campo novo no
framework, e o telefone já estava no tipo `Apartment`. Regra AGENTS.md:
`node_modules/next/dist/docs/` consultado antes de qualquer mudança de schema
— não aplicável aqui, nenhuma API do Next foi tocada.

## Validation Criteria

- [x] `tests/unit/telefone.test.ts` — 16 casos, incluindo a armadilha do `+55`
      (medir o comprimento antes de tirar o prefixo troca celular por fixo), o
      índice do nono dígito (`local[2]`, não `local[0]`: o índice 0 é o DDD) e a
      distinção entre "não é E.164" e "é válido mas de outra região".
- [x] `lib/phone-gate.ts ehTelefoneValido` — mesmo formato que o scraper produz.
- [x] `expansao-base` e `s001-data` exigem E.164 válido quando há telefone, e
      falham se a base inteira ficar sem telefone.
- [x] 25/25 Apolar com telefone, via API, sem browser e sem clique.
- [x] 16 imóveis de 14 imobiliárias com celular lido do site de cada uma, CRECI
      conferido contra o anúncio.
- [x] A validação barrou 2 "celulares" que eram fixo de 8 dígitos, e 7
      anunciantes foram recusados com motivo registrado em vez de chutar.
- [x] `tsc --noEmit` limpo, `eslint` limpo, **157/157 testes verdes**.

## Nota de encoding (armadilha)

`lib/data.ts` **não é UTF-8** — é Windows-1252 (`"VivaReal · 211095"`,
`"Lançamentos"`). Ler com `readFileSync(p, "utf8")` e escrever de volta troca
cada byte inválido por `U+FFFD` e corrompe o arquivo inteiro. Qualquer script que
escreva `lib/data.ts` tem que usar `"latin1"`, que faz round-trip byte a byte.
