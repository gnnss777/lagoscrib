# QA Plan — Leva dores-consumidor

Data: 2026-09-22 · Autor: OpenCode (skill qa-plan) · Escrito ANTES da implementação (G7).
Base: stories S001–S007, `DESIGN.md` §10 (QC), ADR-002 (Validation Criteria).

## Mapa story → tipo → automação → manual mínimo

| Story | Tipo | Automatizar (unit / e2e) | Manual mínimo |
|---|---|---|---|
| S001 schema+venda | Logic + Config/Data | `tests/unit/pricing.test.ts` (pricePerM2, totalAllIn, condoUnknown) | conferir 1 card de venda no dashboard (valores = anúncio) |
| S002 galeria (dados) | Config/Data | `scripts/audit-photos.mjs` (RIFF/WEBP, largura ≥ 800px, ≤ 350KB, peso/imóvel ≤ 3,5MB) + manifesto | abrir 1 galeria e contar fotos × manifesto |
| S003 galeria+lightbox | UI | `tests/unit/gallery.test.ts` (índice/wrap/contador/legenda) + `e2e/galeria.spec.ts` (AC-GAL-01/02, AC-ZOOM-01) | pinch no mobile + reduced-motion ligado |
| S004 anti-dores | UI + Logic | `tests/unit/antidores.test.ts` (buildWhatsAppConfirm, buildMovelCost, buildChecklistText) + `e2e/antidores.spec.ts` + `e2e/persistencia.spec.ts` | 1 fluxo real de copiar checklist + abrir wa.me |
| S005 comparação | UI + Logic | `tests/unit/compare.test.ts` (sort + limite 4) + `e2e/comparacao.spec.ts` (AC-COMP-01) | tabela em viewport 360px (scroll horizontal ok, sem quebra) |
| S006 venda | UI + Config/Data | `e2e/venda.spec.ts` (AC-TOGGLE-01) + regressão: suite inteira verde | alternar abas 3× seguidas (sem estado preso) |
| S007 portões | Processo | smoke-check → perf → security quick → regression → evidence → changelog → pre-commit → PR | revisar diff do PR + CI verde |

## Tipos de teste (definição da skill)

- **Logic:** funções puras (`lib/*.ts`) — vitest, determinístico, sem I/O nem DOM.
- **UI:** comportamento visível — Playwright (clique, teclado, screenshot, console limpo).
- **Integration:** persistência localStorage `version: 2` lendo estado v1; wa.me com texto codificado; `next/image` remoto vs local.

## Portão de saída por story (antes de "done")

1. `npm run typecheck` + `npm run lint` (0 erros) + `npm run build` verdes.
2. Specs da story verdes + **suite inteira** verde (nunca quebrar o que funciona).
3. Zero erro de console no fluxo da story (Playwright).
4. Screenshot da evidência anexado ao caminho declarado no story card.

## Sign-off da leva (F7)

smoke-check PASS → perf-profile dentro dos budgets → security-audit quick sem achado
alto → regression-suite 100% → test-evidence-review ADEQUATE → changelog →
requesting-code-review pré-commit → push + 2 PRs com CI monitorado.
