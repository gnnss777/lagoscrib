# UX Spec — Painel de Filtros Avançados (S009)

> Status: APPROVED (ux-review, 2ª rodada — 8/8 requisitos, 22/09/2026).
> Regras-mãe: plano `lagoscrib-filtros-variaveis.md` §F2 + camada AAA (decisão
> do Gabriel) + DESIGN.md (mandato 0.1–0.4, tokens navy/gold, QC §10).

## Layout (progressive disclosure, DESIGN regra 0.1)

- Linha de filtros existente mantida: busca texto + bairro + status + sort novo.
- Botão `Mais filtros (N)` → painel recolhível (`data-testid="filter-panel"`),
  `aria-expanded` no botão, Esc fecha, foco entra no painel ao abrir (botão
  "Limpar filtros" se visível, senão o primeiro select).
- Seções: Quartos/Banheiros/Vagas (selects `mín X+` + "Tanto faz") · Preço
  min/max (label muda com a aba: "Aluguel total /mês" vs "Preço de venda") ·
  Área min/max · Condomínio "até R$X" + checkbox "Sem condomínio" · Mobiliado
  e Pets (segmentados 3 estados: Tanto faz/Sim/Não, `aria-pressed`) ·
  Facilidades em chips agrupados (`FACILITY_GROUPS`) · "Limpar filtros"
  (só com ≥1 ativo).

## Acessibilidade AAA (regras duras, verificáveis no e2e)

- **Teclado**: Tab percorre TODOS os controles em ordem (botão Mais filtros →
  selects → inputs numéricos → checkboxes → segmentados → chips → ações);
  chips são `<button type="button">` nativos (Enter/Espaço ativam sem handler
  custom); Esc fecha o painel e devolve o foco ao botão "Mais filtros";
  `:focus-visible` com anel gold 2px em todo interativo (nunca só outline:none).
- **Rótulos e alvos**: todo select/input numérico tem `<label>` visível
  associado via `htmlFor` (placeholder = dica, nunca o único rótulo);
  todo alvo de toque `min-h-11` (44px); chips `aria-pressed` + ícone ✓.
- **Movimento**: painel usa `motion/react` com `transition={{ duration: 0.2 }}`
  e respeita `prefers-reduced-motion` (Motion reduz automaticamente via
  `useReducedMotion` — sem animação de expansão quando ativo).
- **Leitura de tela**: `aria-live="polite"` no contador de resultados;
  `role="group"` + `aria-label` por seção; contagens como texto ("Elevador · 4").

## ACs

- AC-FILT-01: aplicar quartos 3+ + preço máx R$ 3.800 + Elevador → 1 card
  (Comendador, R$ 3.629) + "1 de 7 apartamentos"; Limpar → volta a 7.
- AC-FILT-02: bairro de imóvel novo (via form) aparece no dropdown e filtra.
- AC-FILT-03: reload restaura filtros (chave `apartamentos-app-filters` v1).
- AC-FILT-04: sort menor preço → Castro (R$ 2.350) primeiro; maior área →
  Comendador (130m²) primeiro.
- AC-FILT-05: zero erro de console em todos os fluxos.
- AC-FILT-06: teclado completo — Playwright: Tab até o botão "Mais filtros",
  Enter abre, Tab alcança o select de quartos, Esc fecha e o foco volta ao
  botão (assert `toBeFocused`); chip de facilidade ativável via
  `keyboard.press("Enter")` com `aria-pressed` virando "true".
- AC-FILT-07: estado nunca só por cor — chip ativo = borda gold +
  preenchimento + ícone ✓; `aria-pressed` correto.
- AC-FILT-08: contagem ao vivo por opção ("Elevador · N") + "Marcar todas /
  Limpar todas" por grupo; `aria-live` no contador de resultados.
- AC-FILT-09: empty state cita os filtros ("Nenhum imóvel com ... — ajuste
  os filtros") + botão "Limpar filtros" dentro.
- AC-FILT-10: regressão zero — `npx playwright test` full suite verde sem
  alterar nenhum spec antigo; smoke segue vendo 7 cards no default.

## Notas de implementação

- Lógica em `lib/filters.ts` (S008, já verde); componente só chama e renderiza.
- Persistência Dashboard-local com debounce 300ms (desvio documentado do plano
  que previa AppContext: evita re-render global a cada tecla; mesma chave,
  mesma versão, mesmo try/catch aditivo).
- `NEIGHBORHOODS` dinâmico de `allApartments` (fix do bug §0 do plano).
- Sort default `recentes` preserva a ordem atual (sort estável + empates).
