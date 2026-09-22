# S007 — F7 Portões, evidência e PRs

- **Type:** Processo/QA · **Estimativa:** 3h + CI · **ADR:** ADR-001 + ADR-002 (Validation Criteria)
- **Arquivos:** `EVIDENCIA-VALIDACAO.md` (append seção DONE — nunca apagar histórico), `docs/regression-suite.md` (novo), PRs no GitHub
- **Out-of-scope:** código novo de produto; só portões, evidência e entrega.

## AC (portões em ordem — QA plan)
1. **smoke-check:** `build` + `typecheck` + `lint` (0 erros) + suite completa verdes → PASS.
2. **perf-profile:** budgets DESIGN.md §10 atendidos (≤350KB/foto, ≤3,5MB/imóvel, zero CLS, `priority`/`lazy` corretos).
3. **security-audit quick:** zero segredo no diff; notas/checklist como texto (sem `dangerouslySetInnerHTML`); localStorage try/catch + `version: 2` lendo v1; `wa.me` codificado.
4. **regression-suite:** `docs/regression-suite.md` cobre login/cards/modal/notas/status/form + novos fluxos; 100% verde.
5. **test-evidence-review:** cada story com evidência ADEQUATE (não só existente); seção DONE em EVIDENCIA-VALIDACAO via append.
6. **changelog:** corpo dos PRs (interno) + README player-facing.
7. **requesting-code-review** pré-commit + push; **2 PRs em sequência** (`feat/dados-reais` → upstream, depois `feat/dores-consumidor` → upstream) com CI monitorado até verde; auto-review pré-push.

## Test Evidence
`docs/regression-suite.md` + seção DONE em EVIDENCIA-VALIDACAO + links dos 2 PRs.

## story-readiness
- [x] ADRs aceitos · [x] Portões ordenados com critério PASS/FAIL · [x] Estimativa registrada
- [x] Evidência declarada · [x] Depende de S001–S006 — por último
- **Veredito: READY**
