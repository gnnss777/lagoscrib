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
   | **Zap / VivaReal** | 1 clique em "mostrar telefone" na página de detalhe | Registra lead no painel do anunciante |
   | Zap / VivaReal (anúncios com formulário) | Exige Nome/Telefone/E-mail do visitante + aceite de Termos | **Não automatizado** — ver §4 |
   | **OLX** | — | Links de `data/coleta/olx.json` estão mortos ("Anúncio não encontrado") |
   | **E-mail** | — | Nenhum dos 4 portais publica e-mail do anunciante. Segue vazio por decisão |

3. **Formato canônico: E.164 com `+55`.** `+5541996990773` (celular) e
   `+554131213565` (fixo). Celular = 11 dígitos depois do `+55`, com o nono
   dígito em `9`. Este é o formato que `buildWhatsAppLink`
   (`lib/antiDores.ts`) e `maskPhone` (`lib/phone-gate.ts`) já esperavam, então
   **não há mudança de UI** — `ApartmentCard` e `DetailModal` renderizam o botão
   de telefone assim que o dado existe.

4. **Formulário de lead não é automatizado.** Preencher "Informe seus dados
   para ver o telefone" significa enviar dados pessoais do dono do app para
   cada anunciante, com aceite explícito dos Termos do portal. Isso é decisão do
   dono, não default de implementação. Anúncios com esse comportamento ficam
   sem telefone, e o manifesto reporta a cobertura.

5. **Cobertura zero na leva = alerta, não erro.** A leva não aborta, mas
   `manifesto.py` e o final de `coleta.mjs` avisam. Silêncio é o que escondeu
   esse problema por meses (postmortem `imovel-scraper` ERRO-2: *"falha
   silenciosa é pior que erro"*).

## Consequências

- 25/25 imóveis do Apolar da base têm telefone, sem browser e sem clique.
  **Todos o mesmo número**: os 25 são da imobiliária `Locação Centro`
  (`+5541991210624`). `Pinhais` e `Personnalite` existem na API mas ficam em
  bairros fora do escopo de Curitiba.
- Os 39 imóveis de Zap/VivaReal seguem sem telefone até o dono decidir sobre o
  formulário de lead. Anúncios que revelam direto (comportamento tipo 1)
  são coletados automaticamente pelo `extrairTelefone`.
- `phone` no `lib/data.ts` é **público no bundle**. O repo é público
  (`gnnss777/lagoscrib`) e o context pack do projeto registra que o dono já
  aceitou exposição de telefone. Consequência: a promessa de
  `app/privacidade/page.tsx` ("exibimos o telefone somente em horário
  comercial") **não é mais verdade** e foi corrigida nesta leva.
- O telefone é da **imobiliária anunciante**, não de pessoa. No Apolar isso é
  explícito: o mesmo celular em todos os anúncios de uma loja.

## Alternativas rejeitadas

- **Interceptar XHR em vez de clicar**: desnecessário. O clique já publica o
  número no DOM, e interceptar request seria mais frágil que um clique.
- **Normalizar para `(41) 99699-0773`**: `maskPhone` e `buildWhatsAppLink`
  já sabem lidar com `+55…`. Normalizar seria reescrever algo certo.
- **Preencher o formulário de lead**: ver §4.
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

- [x] `tests/unit/telefone.test.ts` — 8 casos, incluindo a armadilha do `+55`
      (medir o comprimento antes de tirar o prefixo troca celular por fixo) e o
      índice do nono dígito (`local[2]`, não `local[0]`: o índice 0 é o DDD).
- [x] `lib/phone-gate.ts ehTelefoneValido` — mesmo formato que o scraper produz.
- [x] `expansao-base` e `s001-data` exigem E.164 válido quando há telefone, e
      falham se a base inteira ficar sem telefone.
- [x] 25/25 Apolar com telefone, via API, sem browser e sem clique.
- [x] `tsc --noEmit` limpo, `eslint` limpo, **148/148 testes verdes**.

## Nota de encoding (armadilha)

`lib/data.ts` **não é UTF-8** — é Windows-1252 (`"VivaReal · 211095"`,
`"Lançamentos"`). Ler com `readFileSync(p, "utf8")` e escrever de volta troca
cada byte inválido por `U+FFFD` e corrompe o arquivo inteiro. Qualquer script que
escreva `lib/data.ts` tem que usar `"latin1"`, que faz round-trip byte a byte.
