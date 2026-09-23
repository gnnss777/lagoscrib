# UX Spec — Galeria e Confiança (leva dores-consumidor)

Data: 2026-09-22 · Autor: OpenCode (skill ux-design) · Base: `DESIGN.md` + ADR-002.
Status do review: **APPROVED** (ux-review em F0′, ver rodapé).

## 1. Escopo
Superfícies novas/alteradas: DetailModal viewer-first (Gallery + Tabs),
ImageLightbox, AllInPanel, VerifiedBadge + botão WhatsApp, VisitChecklist,
aba Planta, CompareBar + CompareModal, Toggle Alugar|Comprar, bloco de valores
de venda, campo tipo no AddApartmentForm. Fora de escopo: mapa/geo, backend,
PWA/offline.

## 2. Fluxos

### F1 — Ver fotos e dar zoom
1. Usuário abre card → modal abre com a **foto principal em destaque** (viewer-first).
2. Thumbs navegáveis (clique, setas ◀▶, teclado ←/→, swipe no mobile) + contador `3/12` + legenda por foto.
3. Clique na principal (ou botão ampliar) → lightbox fullscreen: zoom por clique/scroll/pinch, pan ao arrastar, Esc fecha.
4. `prefers-reduced-motion`: zoom vira troca instantânea, sem animação.

### F2 — Avaliar custo e confiança
1. Aba Detalhes: AllInPanel (aluguel+cond+IPTU = total; venda: preço+cond+IPTU+preço/m²) + "Entrada estimada" + "Mudança estimada", rotuladas "estimativa — confirmar com a imobiliária".
2. Selo "Verificado em {data} · {origem}" + botão "Confirmar disponibilidade" (abre `wa.me` com as 4 perguntas) + regra de ouro fixa anti-golpe junto ao contato.

### F3 — Checklist e planta
1. Aba Checklist: itens marcáveis que persistem (`version: 2`), botões "Copiar" (→ toast) e "WhatsApp".
2. Aba Planta: renderiza `floorPlan` quando existe; caso contrário, aviso "Planta não divulgada no anúncio" (nunca imagem quebrada).

### F4 — Comparar e alternar compra
1. Checkbox "comparar" no card mínimo (máx 4; card sem links/endereço — contato e Prospectar vivem no modal) → CompareBar sticky com contador → CompareModal (tabela, ordem default por custo total efetivo, ausente = "—", links originais clicáveis).
2. Toggle Alugar|Comprar filtra lista, stats e busca; card de venda sem sufixo "/mês".

## 3. Estados obrigatórios (DESIGN.md §0.4)

| Superfície | Loading | Empty | Error |
|---|---|---|---|
| Gallery | skeleton mesma geometria | 0 fotos → capa + aviso | `onError` → pula slide, nunca ícone quebrado |
| AllInPanel | skeleton | — (sempre há total) | valor ausente → "—" |
| Checklist | — | lista vazia → empty + CTA | falha de clipboard → toast de erro + retry |
| Compare | — | <2 selecionados → hint | — |
| Lista (venda) | skeleton | 0 vendas → empty + CTA voltar ao aluguel | — |

## 4. Acessibilidade (AC de a11y — DESIGN.md §10)

- Focus trap no modal/lightbox/compare; Esc fecha; foco retorna ao elemento de origem.
- Galeria operável 100% por teclado (←/→, +/-, 0 reseta zoom).
- Alvos ≥ 44px touch / ≥ 32px desktop (setas, thumbs, checkbox, toggle).
- `alt` descritivo + legenda visível em toda foto; contraste AA (axe, zero falhas).
- `aria-live="polite"` no toast; `role="switch"` no toggle; `role="status"` no skeleton.

## 5. Critérios de aceite (testáveis, com número)

1. **AC-GAL-01:** abrir qualquer imóvel → principal renderiza em ≤ 2s (rede rápida), contador `1/N` correto, `naturalWidth > 0` em todas as N fotos (N ≥ 8).
2. **AC-GAL-02:** ←/→ percorre as N fotos com wrap; legenda acompanha o índice; zero erro de console.
3. **AC-ZOOM-01:** lightbox abre por clique e por teclado; zoom 1x→2x→4x; pan arrasta sem sair do viewport; Esc fecha e devolve o foco.
4. **AC-ALLIN-01:** painel exibe total = soma dos componentes (± R$ 1 de arredondamento); estimativas trazem o rótulo "estimativa — confirmar com a imobiliária".
5. **AC-WA-01:** "Confirmar disponibilidade" abre `wa.me` com as 4 perguntas (disponibilidade, condomínio atual, pets, fiador) e nome do imóvel; regra de ouro visível sem scroll no bloco de contato.
6. **AC-CHECK-01:** marcar item → persiste após reload; "Copiar" → toast + texto com nome/valores do imóvel; lista vazia → empty state (nunca branco).
7. **AC-PLANTA-01:** com `floorPlan` → aba renderiza imagem; sem → aviso textual, sem request quebrado.
8. **AC-COMP-01:** 3 selecionados → tabela com totais corretos e links; 5º → bloqueio visível; ordem default por custo total efetivo.
9. **AC-TOGGLE-01:** alternar Alugar|Comprar sem erro; vendas sem "/mês"; busca/stats refletem a aba ativa.
10. **AC-A11Y-01:** fluxo completo só-teclado; axe zero violações; `prefers-reduced-motion` sem animação; alvos medidos ≥ mínimo.

## ux-review (skill ux-review — F0′)

- Completude: fluxos F1–F4 cobrem todas as superfícies do plano; estados loading/empty/error por superfície (§3). ✔
- A11y: trap/Esc/teclado/alvos/contraste/legendas explícitos com número. ✔
- GDD alignment: nomes = glossário DESIGN.md §9; tokens/motion/elevation = DESIGN.md §1/§5/§6; sem hex/tamanho fora de escala. ✔
- Implementabilidade: componentes mapeados 1:1 para arquivos (DetailModal, ImageLightbox, VisitChecklist, CompareModal, constants); lógica pura isolada p/ TDD. ✔
- **Veredito: APPROVED** — sem NEEDS REVISION; pode avançar para F3/F4/F5.
