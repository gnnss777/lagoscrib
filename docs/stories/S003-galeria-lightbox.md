# S003 — F3 Galeria no app + lightbox

- **Type:** UI · **Estimativa:** 5h · **ADR:** ADR-002 (galeria própria + fallback)
- **Arquivos:** `DetailModal.tsx` (viewer-first), `ImageLightbox.tsx` (novo), `ApartmentCard.tsx` (mini-galeria P2 — decidir sem estourar escopo; default: capa), `tests/unit/gallery.test.ts`, `e2e/galeria.spec.ts`
- **Out-of-scope:** anti-dores (S004), comparação (S005); lib externa só se estourar ~250 linhas (fallback ADR-002).

## AC
1. Playwright (`e2e/galeria.spec.ts`): abrir imóvel → N fotos navegáveis (seta + teclado ←/→ + swipe) → zoom abre → pan funciona → Esc fecha; AC-GAL-01/02 + AC-ZOOM-01 da UX spec.
2. Contador `i/N` + legenda corretos em todos os imóveis; `naturalWidth > 0` em todas; zero erro de console.
3. Focus trap + Esc + `prefers-reduced-motion` (zoom vira troca instantânea) verificados.
4. Perf budgets (DESIGN.md §10): ≤ 350KB/foto, peso/imóvel ≤ 3,5MB, `priority` só na 1ª, demais `loading="lazy"`, `width`/`height` fixos (zero CLS), full-res só no lightbox; migração para `next/image` (resolve os 2 warnings `@next/next/no-img-element` do lint).
5. TDD: núcleo puro de navegação (índice, wrap, contador, legenda) em `tests/unit/gallery.test.ts`; zoom/pan = UI → Playwright.
6. Estados: 0 fotos → fallback capa + aviso (empty); `onError` → pula slide (error).

## Test Evidence
`e2e/galeria.spec.ts` + screenshots (galeria, zoom).

## story-readiness
- [x] ADR aceito · [x] UX spec APPROVED cobre a story · [x] AC testáveis com número
- [x] Estimativa registrada · [x] Evidência declarada
- **Veredito: READY**
