# S001 — F1 Schema + dados de venda

- **Type:** Config/Data + Logic · **Estimativa:** 4h · **ADR:** ADR-001 (estende schema), ADR-002
- **Arquivos:** `lib/data.ts`, `lib/constants.ts` (novo, faixas com fonte), `tests/unit/pricing.test.ts`
- **Out-of-scope:** UI de venda (S006), galeria (S002/S003), mapa/geo, backend.

## AC
1. `tsc --noEmit`, `eslint .` (0 erros) e `build` verdes.
2. 7 aluguel + 4–6 venda em `lib/data.ts` com `transaction`, `verifiedAt`, `photos` (capa), `salePrice?`/`floorPlan?`; simulados intactos.
3. `tests/unit/pricing.test.ts` verde (TDD RED→GREEN antes de tocar `data.ts`): `pricePerM2` (1 decimal), `totalAllIn` (aluguel = aluguel+cond+iptu; venda = `salePrice`; `condoUnknown` nunca soma cond fictício).
4. Coleta venda via browser real (LL-045/046): links validados, delay 2–4s, ≥ 8 fotos/imóvel validadas antes de salvar (ver S002); sem inventar taxa de financiamento; mínimo 4 (com 3, avançar documentando).

## Test Evidence
`tests/unit/pricing.test.ts` + screenshot dashboard com venda.

## story-readiness
- [x] ADR aceito (ADR-001 retrofit + ADR-002) · [x] AC testáveis com número
- [x] Estimativa registrada · [x] Evidência declarada · [x] Sem questão de design aberta
- **Veredito: READY**
