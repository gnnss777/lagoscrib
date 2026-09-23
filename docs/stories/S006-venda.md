# S006 — F6 Venda

- **Type:** UI + Config/Data · **Estimativa:** 4h · **ADR:** ADR-002 (`transaction`, bloco condicional)
- **Arquivos:** `Dashboard.tsx` (toggle Alugar|Comprar, stats/busca por aba), `DetailModal.tsx` (bloco condicional), `AddApartmentForm.tsx` (campo Aluguel/Venda), `ApartmentCard.tsx` (sufixo "/mês" só aluguel), `e2e/venda.spec.ts`
- **Out-of-scope:** financiamento/simulador (sem inventar taxa); mapa/geo.

## AC
1. Playwright (`e2e/venda.spec.ts` = AC-TOGGLE-01): toggle alterna sem erro nem estado preso (3 alternâncias seguidas); 4–6 vendas reais na aba Comprar com valores = anúncio; vendas sem "/mês"; busca + stats refletem a aba ativa.
2. Modal de venda: preço + cond + IPTU + preço/m²; SEM "entrada estimada de locação" (bloco de locação não aparece em venda).
3. Status workflow reutilizado nas duas abas (novo→…→aprovado/recusado) sem duplicar código.
4. **Regressão zero no fluxo de aluguel**: suite completa (antiga + nova) verde.

## Test Evidence
`e2e/venda.spec.ts` + screenshot das duas abas.

## story-readiness
- [x] ADR aceito · [x] UX spec APPROVED cobre a story · [x] AC testáveis com número
- [x] Estimativa registrada · [x] Evidência declarada · [x] Depende de S001 (dados venda) — sequência respeitada
- **Veredito: READY**
