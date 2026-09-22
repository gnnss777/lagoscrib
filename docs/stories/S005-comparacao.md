# S005 — F5 Comparação lado a lado

- **Type:** UI + Logic · **Estimativa:** 4h · **ADR:** ADR-002 (2–4 client-side, ordem por custo efetivo)
- **Arquivos:** `CompareModal.tsx` (novo), `Dashboard.tsx` (faixa sticky + seleção), `ApartmentCard.tsx` (checkbox "comparar"), `tests/unit/compare.test.ts`, `e2e/comparacao.spec.ts`
- **Out-of-scope:** galeria, checklist; ordenação custom pelo usuário (default fixo).

## AC
1. TDD em `tests/unit/compare.test.ts`: `sortCompareByTotalEffective` (aluguel = custo all-in; venda = preço) + limite de 4 (5º bloqueado).
2. Playwright (`e2e/comparacao.spec.ts` = AC-COMP-01): selecionar 3 → tabela abre com linhas e totais corretos → links originais clicáveis; tentar o 5º → bloqueio visível com aviso; ordem default por custo total efetivo.
3. Tabela: miniatura, bairro, área, quartos/banheiros/vagas, aluguel/preço, cond, IPTU, total/mês, preço/m², flags (`sem garagem`/`sem elevador`/`cond a confirmar`), pets, origem + link. Ausente = "—".
4. Checkbox ≥ 44px; barra sticky com contador (2–4); tabela legível em 360px (scroll horizontal permitido, sem quebra).

## Test Evidence
`e2e/comparacao.spec.ts` + screenshot da tabela.

## story-readiness
- [x] ADR aceito · [x] UX spec APPROVED cobre a story · [x] AC testáveis com número
- [x] Estimativa registrada · [x] Evidência declarada
- **Veredito: READY**
