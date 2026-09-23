# S004 — F4 Anti-dores de confiança

- **Type:** UI + Logic · **Estimativa:** 5h · **ADR:** ADR-002 (constantes, checklist `version: 2`)
- **Arquivos:** `DetailModal.tsx`, `VisitChecklist.tsx` (novo), `lib/AppContext.tsx` (checklist versionado), `lib/constants.ts`, `lib/antiDores.ts` (novo, funções puras), `tests/unit/antidores.test.ts`, `e2e/antidores.spec.ts`, `e2e/persistencia.spec.ts`
- **Out-of-scope:** galeria (S003), comparação (S005); sem inventar valores.

## AC
1. TDD RED→GREEN em `lib/antiDores.ts`: `buildWhatsAppConfirm` (4 perguntas: disponibilidade, condomínio atual, pets, fiador), `buildMovelCost(nRooms)` (faixas de constantes), `buildChecklistText` — constantes em `lib/constants.ts` (caução 3×, fiança 10–15%, mudança ex. 3+ quartos R$ 1.000–1.800, fonte comentada).
2. UI: AllInPanel ("Entrada estimada" + "Mudança estimada", rótulo "estimativa — confirmar com a imobiliária"); selo "Verificado em {verifiedAt} · {source}"; botão "Confirmar disponibilidade" (`wa.me` + mensagem); **regra de ouro fixa** "Não pague nada antes de visitar o imóvel pessoalmente" em todo modal com contato; aba Planta (`floorPlan` ou aviso "Planta não divulgada no anúncio"); checklist (marca→persiste `version: 2`, copia→toast, WhatsApp).
3. Playwright: 3 fluxos (all-in renderiza faixas; WhatsApp com as 4 perguntas; checklist persiste/recarrega/copia).
4. `grep -i "entrada estimada\|mudança estimada"` → só em `lib/constants.ts` e componentes que importam constantes (LL-006).
5. Regressão zero: notas/status antigos persistem após `version: 2` (`e2e/persistencia.spec.ts`).

## Test Evidence
`e2e/antidores.spec.ts` + `e2e/persistencia.spec.ts` + screenshots.

## story-readiness
- [x] ADR aceito · [x] UX spec APPROVED cobre a story · [x] AC testáveis com número
- [x] Estimativa registrada · [x] Evidência declarada
- **Veredito: READY**
