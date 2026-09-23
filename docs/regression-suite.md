# Regression Suite — levas dores-consumidor (S007) + filtros-avancados (S011)

> Cobertura de não-regressão: cada comportamento antigo tem spec que o trava.
> 100% verde em 22/09/2026 (63 unit + 9 e2e). Rodar antes de todo push.

## Fluxo de aluguel (pré-leva, intocado)

| Comportamento | Trava | Status |
|---|---|---|
| Login + 7 cards no dashboard | `e2e/smoke.spec.ts` | verde |
| Busca texto + bairro + status (AND) | `e2e/smoke` + filtros antigos em `Dashboard.tsx` (inalterados) | verde |
| Modal abre do card, fecha no Esc | `e2e/galeria.spec.ts` (fecha modal no fim) | verde |
| Notas: adicionar + listar | `e2e/persistencia.spec.ts` (nota v1 exibida) | verde |
| Status workflow (7 estados) | `e2e/persistencia.spec.ts` (agendado com ring) | verde |
| Estado v1 (sem version) legível após v2 | `e2e/persistencia.spec.ts` | verde |
| AddApartmentForm (aluguel segue default) | `lib/transaction.ts` (`isSale` falso sem campo) + `tests/unit/transaction.test.ts` | verde |

## Novos fluxos (leva, travados contra regressão futura)

| Comportamento | Trava | Status |
|---|---|---|
| Galeria 11 fotos, seta/teclado/wrap/thumbs, zoom 1x→2x, Esc | `e2e/galeria.spec.ts` | verde |
| Núcleo puro galeria (índice/contador/alt/zoom) | `tests/unit/gallery.test.ts` (10) | verde |
| AllInPanel + estimativas + WhatsApp 4 perguntas + checklist + planta | `e2e/antidores.spec.ts` | verde |
| Lógica pura anti-dores | `tests/unit/antidores.test.ts` (7) | verde |
| Comparação: ordem, bloqueio do 5º, links | `e2e/comparacao.spec.ts` | verde |
| Lógica pura comparação | `tests/unit/compare.test.ts` (8) | verde |
| Toggle Alugar\|Comprar, 5 vendas, modal de venda | `e2e/venda.spec.ts` | verde |
| Lógica pura transação | `tests/unit/transaction.test.ts` (5) | verde |
| Precificação (`pricePerM2`, `totalAllIn`) | `tests/unit/pricing.test.ts` | verde |
| Dados: 7 aluguel sem venda + 12×11 fotos em disco | `tests/unit/s001-data.test.ts`, `tests/unit/s002-galeria.test.ts` | verde |
| Metragem no header do comparativo (123/78/90m²) | `e2e/comparacao.spec.ts` (S012) | verde |

## Novos fluxos — leva filtros-avancados (PR-3)

| Comportamento | Trava | Status |
|---|---|---|
| Núcleo puro filtros (busca, mín X+, preço/área, AND facilidades, negação, pets/mobiliado 3-state, ausente passa, sorts, contador) | `tests/unit/filters.test.ts` (22) | verde |
| Combinação quartos 3+ + máx 3800 + Elevador → 1 card; limpar → 7 | `e2e/filtros.spec.ts` | verde |
| Teclado (Enter abre, Esc fecha + foco volta, chip via Enter) | `e2e/filtros.spec.ts` | verde |
| Persistência filtros no reload (poll do debounce) | `e2e/filtros.spec.ts` | verde |
| Sort menor preço / maior área no primeiro card | `e2e/filtros.spec.ts` | verde |
| Empty state cita filtros + limpar dentro | `e2e/filtros.spec.ts` | verde |
| Bairro de imóvel novo no dropdown e filtra | `e2e/filtros.spec.ts` | verde |
| Form completo: 4/2/2 entra em 3+ + Elevador, sai em banheiros 3+ | `e2e/form.spec.ts` | verde |
| Filtros default = ordem antiga intacta (smoke segue 7 cards) | `e2e/smoke.spec.ts` | verde |

## Infra de determinismo

- `playwright.config.ts`: `workers: 1` (flakes de imagem sob 4 workers eram carga no `next dev`, não bug — S006).
- `workers` serial: full suite ~30s.
