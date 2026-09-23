# ADR-002 — UI de confiança da leva dores-consumidor

Data: 2026-09-22. Status: aceita (branch `feat/dores-consumidor`, F0′).

## Contexto
A leva dores-consumidor adiciona galeria completa, custo all-in, anti-ghost,
comparação, checklist de visita, planta baixa e aba de venda ao app. Sem decisões
registradas, cada implementação escolheria libs e formatos de persistência
diferentes — risco de deps pesadas, quebra de notas/status salvos e valores
hardcoded espalhados (LL-006).

## Decisão
1. **Galeria própria + lightbox com `motion/react`** (já dependência do projeto).
   Fallback documentado: `yet-another-react-lightbox` se a implementação própria
   estourar ~250 linhas. Sem lib externa por padrão (menos dep, menos licença).
2. **Checklist persistido em localStorage sob a MESMA chave** (`apartamentos-app-state`),
   com schema **aditivo versionado** (`version: 2`). Notas e status existentes
   continuam lendo/escrevendo sem migração destrutiva.
3. **Schema estendido de forma aditiva**: `photos?: Photo[]`, `transaction: "aluguel" | "venda"`,
   `salePrice?`, `floorPlan?`, `verifiedAt`. Card/modal/formulário antigos continuam
   aceitando objetos sem os campos novos.
4. **Comparação 2–4 imóveis no client**, ordenada por custo total efetivo
   (aluguel: all-in mensal; venda: preço). 5º selecionável bloqueado com aviso visível.
5. **Estimativas centralizadas em `lib/constants.ts`** com comentário da fonte
   (caução 3× aluguel; fiança 10–15%; mudança por faixa de cômodos). Hardcode de
   valor monetário fora de constantes = erro de review (LL-006).
6. **Tooling (resolução G2)**: `next lint` removido no Next 16 (ver
   `node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`)
   → script `lint` = `eslint .` (CLI) com `eslint.config.mjs` flat
   (`eslint-config-next/core-web-vitals`). Os 2 warnings restantes
   (`@next/next/no-img-element` em `ApartmentCard`/`DetailModal`) ficam **deferidos
   para F3**, quando a galeria migra para `next/image` com budgets (≤350KB,
   `priority` na 1ª, `lazy` nas demais). Não suprimir — migrar.

## Consequências
- Zero nova dependência de runtime (vitest + Playwright são devDeps).
- F3/F4/F5/F6 implementam UI sobre este contrato sem redecidir fundação.
- `DESIGN.md` §4/§9 nomeia os componentes novos (Gallery, Lightbox, AllInPanel,
  VisitChecklist, CompareTable, CompareBar, VerifiedBadge, Regra de ouro).

## Alternativas rejeitadas
- Lib externa de lightbox/galeria (ex.: yet-another-react-lightbox como padrão):
  dep + CSS proprietários para um caso de uso coberto por `motion` + `<img>`.
- Backend para checklist/notas: fora de escopo (mesma decisão do ADR-001).
- Mapa com raio de 5 km: descartado pelo Gabriel (fora da leva).
- `tsc --noEmit` + build como únicos gates (sem eslint): perde as regras
  `react-hooks/*` que já pegaram 2 erros reais em F0′ — manter eslint CLI.

## Status
Aceita. Em vigor desde 2026-09-22 (F0′).

## ADR Dependencies
Depende de ADR-001 (estende o schema/pipeline aqui sem quebrar).

## Engine Compatibility
Next.js 16 (App Router) · domínio UI/Data · risk LOW — `motion/react` e
localStorage são APIs estáveis; `next/image` (F3) é API documentada do framework.

## GDD Requirements Addressed
- `DESIGN.md` §0 (Mandato: clean/intuitivo/sem bugs), §4 (componentes),
  §6 (motion `spring(320, 24)`), §10 (QC numérico).
- Plano `lagoscrib-update-dores-consumidor` F3–F6 + `docs/ux/galeria-e-confianca.md`
  (ux-review APPROVED em F0′).

## Validation Criteria
- [ ] `tsc --noEmit`, `eslint .` (0 erros) e `npm run build` verdes.
- [ ] Suite completa verde (`tests/unit/*` + `e2e/*`), incluindo regressão do fluxo de aluguel.
- [ ] `grep` de literal monetário fora de `lib/constants.ts` = 0 (QC DESIGN.md §10).
- [ ] Notas/status salvos na v1 continuam legíveis após `version: 2` (teste de persistência).
