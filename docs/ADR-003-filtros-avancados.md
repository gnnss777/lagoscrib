# ADR-003 — Filtros avançados da leva filtros-avancados (PR-3)

Data: 2026-09-22. Status: aceita (branch `feat/filtros-avancados`, S008).

## Contexto
O Dashboard filtrava só por busca texto + bairro + status. O schema já carrega
tudo que o consumidor quer filtrar (`bedrooms`, `bathrooms`, `parking`, `area`,
`rent`/`condo`/`iptu`/`total`, `salePrice`, `features[]`, `pets`, `verifiedAt`)
— filtro de cartesianos é só UI + função pura, zero backend. Sem decisão
registrada, cada grupo ganharia semântica própria (AND vs OR, exato vs mín,
o que fazer com dado ausente) — risco de filtros que se contradizem e de
faixas hardcoded nos componentes (LL-006).

## Decisão
1. **Função pura + TDD**: `lib/filters.ts` (`FilterState`, `DEFAULT_FILTERS`,
   `applyFilters`, `applySort`, `countActiveFilters`, `normalizeText`,
   `facilityMatches`, `effectiveFilterPrice`) sem React/sem localStorage.
   Componente só chama e renderiza — mesmo padrão de `lib/antiDores.ts`.
2. **AND entre grupos; AND dentro de facilidades** (padrão Zap/QuintoAndar:
   todas as marcadas). Fácil de relaxar depois — fica aqui registrado.
3. **Semântica "mín X+"** para quartos/banheiros/vagas (1/2/3/4+, vagas até 3+);
   `0` = tanto faz. "Exato" fora da leva.
4. **Preço por transação**: aluguel filtra/ordena por `total` (all-in mensal);
   venda por `salePrice` (componentes mensais não entram na aquisição).
   Limites inclusivos.
5. **Dado ausente nunca exclui** (`undefined` passa no grupo — aditivo, igual
   schema S001). Consequência consciente: `condoUnknown` passa no cap de
   condomínio; imóvel sem `features` passa nas facilidades; sem informação de
   pets passa nos dois lados do toggle (só o explícito "não aceita" sai do
   "sim" e vice-versa). Honestidade > precisão fingida.
6. **Matching de facilidades normalizado** (minúsculas, sem acento) com **guarda
   de negação**: "9º andar com elevador" casa com "Elevador"; "SEM ELEVADOR
   (3º andar)" não casa. Mesma guarda vale p/ pets ("Não aceita animais" não
   é aceite — o substring "aceita animais" enganaria o `includes`).
7. **Ordenação client-side** sobre a lista já filtrada: mais recentes
   (`verifiedAt` → `createdAt` → fim, estável), menor/maior preço, menor
   preço/m², maior área. Default `recentes`: com sort estável e empates
   preservando a entrada, a ordem atual do Dashboard não muda até a UI de
   sort entrar (S009).
8. **Persistência em chave nova** `apartamentos-app-filters` `{version: 1}`
   (S009) — nunca ler/escrever `apartamentos-app-state`. Contador de ativos:
   preço e área contam 1 por grupo; cada facilidade conta 1; ordenação não conta.
9. **Constantes em `lib/constants.ts`** (faixas calibradas com os 12 imóveis
   reais: aluguel 0–10.000, venda 0–2.000.000, área 0–1.000m², condomínio
   0–5.000; `FACILITY_GROUPS`; `SORT_OPTIONS`; `FILTER_DEBOUNCE_MS = 300`).
   Literal de faixa fora de constantes = erro de review (LL-006).

## Consequências
- S009 (FilterPanel) e S010 (form completo) implementam UI sobre este contrato
  sem redecidir semântica.
- `NEIGHBORHOODS` dinâmico e metragem no header do CompareModal (S012) usam
  `NEIGHBORHOOD_ALL` e `effectiveFilterPrice` daqui quando convier.
- Filtros nunca quebram com imóvel novo de dados pobres (form S010 melhora a
  entrada, mas a lógica não depende disso).

## Alternativas rejeitadas
- Filtro por backend/Supabase: fora de escopo (12 imóveis, client-side basta).
- OR em facilidades: rejeitado (não é padrão de mercado).
- Slider contínuo de preço/área: dois inputs numéricos (mais testável, e2e lê).
- "Quartos exatos": fora da leva (decisão travada do Gabriel).
- Excluir dado ausente do resultado: rejeitado (puniria anúncio mal preenchido
  e quebraria o contrato aditivo do schema).

## Status
Aceita. Em vigor desde 2026-09-22 (S008).

## ADR Dependencies
Depende de ADR-002 (estende constantes/pipeline sem quebrar; TDD puro como
`lib/antiDores.ts`). Habilita S009/S010/S012. Sem dependência de merge do
upstream (schema atual já tem todos os campos).

## Engine Compatibility
Next.js 16 (App Router) · domínio Data/Logic · risk LOW — TypeScript puro,
`String.normalize("NFD")` e `Array.sort` estável são APIs estáveis; Vitest
cobre 18 casos sem DOM.

## GDD Requirements Addressed
- `lagoscrib-filtros-variaveis.md` §1.1 (variáveis, semântica, regras duras 1–6
  exceto a camada AAA de UI, que é S009) e §1.2 (arquitetura: lógica em
  `lib/filters.ts`, faixas em `lib/constants.ts`).
- `DESIGN.md` §0 (mandato clean/sem bugs) — lógica testável isolada da UI.

## Validation Criteria
`tests/unit/filters.test.ts` 18/18 verde (nomes `test_[sistema]_[cenário]_...`);
full suite 59/59; `tsc` + `eslint` (0/0) verdes; grep por literal de faixa fora
de `lib/constants.ts` vazio.
