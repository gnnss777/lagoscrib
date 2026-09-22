---
version: 1.0
name: lagoscrib
description: Gestor pessoal de imóveis (aluguel + venda) em Curitiba — dashboard limpo, dark premium navy + dourado, extremamente intuitivo, zero atrito. UI exibe estado; nunca é dona do estado.
stack: Next.js 16 App Router + Tailwind 4 + motion/react + Phosphor + Geist
colors:
  paper: "#0B1121"
  surface: "#0F1629"
  surface-2: "#131B33"
  accent: "#C8A66B"
  accent-strong: "#B8924F"
  accent-soft: "#D9BE8A"
  ink: "#F0F0F5"
  ink-soft: "#C8C8D4"
  muted: "#8A92A6"
  disabled: "#6B7280"
typography:
  display: { fontFamily: Geist, weight: 700 }
  body: { fontFamily: Geist, weight: 400 }
  mono: { fontFamily: Geist Mono, weight: 600 }
---

# DESIGN.md — lagoscrib

> Sistema de design para desenvolvimento assistido por IA. Fonte única de verdade visual.
> Última revisão: 2026-09-22 | Dono: Gabriel | Revisão trimestral: sim
> O agente LÊ este arquivo antes de gerar qualquer UI (invariante #1). Diz o *como*; o plano de leva diz o *quê*.
> Aprovado em review de PR (F0′ da leva dores-consumidor).

## 0. Mandato do produto (regras claras — o Gabriel pediu, vira critério de review)

Estas 4 regras dominam TODA decisão de UI. Qualquer tela que as viole = erro de review.

**0.1 Interface clean e extremamente intuitiva**
- **Uma tarefa por superfície:** cada tela/card/modal tem, no máximo, 1 ação primária visível (CTA). As demais ações existem, mas são secundárias/terciárias.
- **Hierarquia implícita:** primeira dobra = decisão (preço + dados essenciais); segunda dobra = contexto (descrição); ação = terceiro nível (contato/checklist/planta).
- **Progressive disclosure:** o card mostra só o essencial; o detalhe vive no modal; o resto vive em abas. Nada de "info dump" no card.
- **Zero jargão:** PT-BR limpo ("aluguel", "condomínio", "IPTU", "vaga", "preço/m²"). Sigla só se o usuário do mercado usa.

**0.2 Sem informações desnecessárias**
- **Regra do mínimo:** o card exibe no máximo 6 campos (bairro, área, quartos, banheiros, vagas, total) + 1 badge de status + 1 tag de preço. Tudo além disso vai para o modal.
- **Regra do corte (testável):** nenhum label com mais de 2 palavras; nenhuma frase além de 1 linha justificada; descrição truncada a 3 linhas com "…"; `grep` de textos supérfluos no QC.
- **Nada duplicado na mesma superfície** (ex.: preço no card E no header do modal sem propósito — no modal o total all-in é o protagonista, não repetir o aluguel 3x).

**0.3 Facilidade de uso (o usuário não "aprende" o app; ele funciona)**
- **Padrões previsíveis:** tudo clicável parece clicável (cursor, hover, focus-visible); botões iguais fazem a mesma coisa em qualquer tela; rótulos consistentes ("Ver anúncio original" sempre onde há link).
- **Atalhos e acessíveis:** Esc fecha modal/lightbox; ←/→ navega galeria; Tab percorre tudo; Enter ativa; foco nunca fica preso (focus trap só dentro de modal e sai no Esc).
- **Toques generosos:** alvos ≥ 44px (touch) / ≥ 32px (desktop); thumbnails, setas e checkbox de comparação nunca menores que isso.
- **Zero beco sem saída:** toda ação tem feedback (toast, mudança de estado, navegação); todo botão desabilitado explica por quê (tooltip/label).

**0.4 Sem erros e sem bugs (qualidade não-negociável)**
- **3 estados obrigatórios** em toda superfície de dados: **loading (skeleton)** / **empty** (com copy real + CTA) / **error** (mensagem + retry). NUNCA tela em branco.
- **Nunca quebrar o que funciona** (anti-pattern MOC): antes de concluir, perguntar "o que essa mudança pode quebrar?"; suite (unit + e2e) roda antes de todo commit; typecheck/lint/build antes de push.
- **Validação com mensagem** em todo formulário (preço numérico, área numérica, obrigatórios) — erro inline, nunca silencioso.
- **Valores com fonte:** moeda via `Intl.NumberFormat("pt-BR")`; toda taxa/faixa em `lib/constants.ts` (hardcode = erro de review — LL-006).
- **Fallbacks:** imagem com erro → placeholder local (nunca ícone quebrado); dado ausente → "—" ou "não informado" (nunca inventar).
- **Dados protegidos:** contatos só se o dado existir (campos vazios escondem botão); link do anúncio original SEMPRE presente; localStorage com try/catch + schema aditivo versionado.

## 1. Colors (tokens reais — `app/globals.css` `@theme`)

| Token (Tailwind) | Hex | Papel |
|---|---|---|
| `navy-950` | `#0B1121` | Fundo do app (--paper) |
| `navy-900` | `#0F1629` | Superfície (cards, modais) |
| `navy-800` | `#131B33` | Superfície elevada (inputs, painéis) |
| `navy-700` | `#1A2442` | Bordas fortes, hover de superfície |
| `navy-600` | `#243054` | Divisórias, ícones inativos |
| `gold-400` | `#C8A66B` | **Accent** (ações primárias, valores, foco, marca) |
| `gold-500` | `#B8924F` | Accent hover/pressed |
| `gold-300` | `#D9BE8A` | Accent sobre navy p/ legibilidade alta, glow |
| `surface-50` | `#F0F0F5` | Texto primário (--ink) |
| `surface-100` | `#E4E4EC` | Texto secundário |
| `surface-200` | `#C8C8D4` | Metadados legíveis |
| `surface-400` | `#8A92A6` | **Muted** (labels, hints, "—") |
| `surface-500` | `#6B7280` | Desabilitado, placeholders |

Regras:
- **NUNCA hex solto fora desta tabela** (invariante #2). Nova cor? Adicionar token aqui + revisão no PR.
- Semânticas: `success`/`warning`/`danger` só em badge de status e validação — nunca reinventar por tela; usar tints de gold para positivo ("Verificado"), surface para neutro.
- **Contraste AA verificado no QC:** texto sobre navy-950 ≥ 4.5:1; gold-400 sobre navy-950 ≥ 4.5:1 (texto); texto navy-950 sobre gold-400 ≥ 4.5:1 (botões primários). Conferir com axe na F7.

## 2. Typography (Geist + Geist Mono — já no `layout.tsx`)

| Papel | Família | Peso | Tamanho | Line-height | Uso |
|---|---|---|---|---|---|
| Display | Geist | 700 | clamp(1.5rem, 4vw, 2rem) | 1.1 | Título do dashboard |
| Heading | Geist | 600 | 1.125rem | 1.25 | Títulos de card/modal/aba |
| Body | Geist | 400 | 0.9375rem | 1.5 | Descrições, copy |
| Caption | Geist | 500 | 0.8125rem | 1.4 | Labels, metadados, legendas de foto |
| Mono | Geist Mono | 600 | 0.9375rem | 1.25 | **Valores monetários, preço/m², contadores** |

Regras: escala fixa (5 papeis, nada de tamanho arbitrário); valores monetários SEMPRE Mono (consistência de leitura); texto grande ≥ 3:1, normal ≥ 4.5:1.

## 3. Spacing & shapes

- Base: 4px. Escala: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 — valor fora = erro de review.
- Raios: inputs/buttons `rounded-lg` (10px), cards/panels `rounded-2xl` (16px), badges/pills `rounded-full`, thumbnails `rounded-xl`.
- Largura: conteúdo `max-w-6xl` no dashboard; modal `max-w-2xl`; lightbox full screen escuro; shells mobile-first (colunas empilham < 640px).

## 4. Components (nomes oficiais do Glossário + novos registrados)

> Nomeação do glossário do estúdio: Badge ≠ Chip; Dialog = bloqueia tela; Toast = some sozinho; Toggle = switch imediato. Novos componentes entram na seção 9.

| Componente | Variantes | Anatomia (tokens) | Estados obrigatórios |
|---|---|---|---|
| Button | primary / secondary / ghost | primary: `bg-gold-400 text-navy-950`; ghost: `border-navy-600 text-surface-50` | default, hover, active, disabled (+motivo), loading, focus-visible ring gold |
| Input + Select | default / error | `bg-navy-800 border-navy-700 rounded-lg px-3 h-11` | default, focus (ring gold), error (+mensagem inline), disabled |
| Toggle (kit #4) | Alugar\|Comprar | pill 48×28, knob branco, accent quando on, `role="switch"` | checked/unchecked, focus-visible, reduced-motion |
| StatusBadge (kit #2) | tom ok/warn/accent por status | pill 13px semibold + borda de tom | estático; acessível via `aria-label` quando só-icone |
| VerifiedBadge | "Verificado em {data} · {origem}" | pill gold-300/navy-950 com ícone ✓ | estático; tooltip com data exata |
| Card (ApartmentCard) | — | gradient navy, `rounded-2xl`, hover translateY(-4px) | default, hover (clicável), focus-visible; **loading = skeleton com a MESMA geometria** |
| Dialog (DetailModal) | Detalhes \| Notas \| Checklist \| Planta (Tabs) | overlay navy-950/80 + panel `max-w-2xl` | open/close com spring; focus trap; Esc; rolável |
| Gallery (Carousel) | — | principal 4:3 `object-cover` + thumbs (lazy) + setas ◀▶ + contador "3/12" + legenda | 1ª photo priority; thumbs lazy; swipe mobile; ←/→ teclado; empty (0 fotos → capa + aviso) |
| Lightbox (Dialog) | — | fullscreen escuro; zoom clique/scroll/pinch; pan arrastar | open/close; Esc; contador; reduced-motion desativa zoom animado |
| AllInPanel | aluguel / venda | painel com linhas aluguel/cond/IPTU + "Entrada estimada" + "Mudança estimada" | rotulado "estimativa — confirmar com a imobiliária"; venda: preço + cond + IPTU + preço/m² |
| VisitChecklist | — | lista de itens com checkbox + botões "Copiar" / "WhatsApp" | TDD: marca→persiste; copy→toast; lista vazia→empty state |
| CompareBar + CompareTable (Table) | — | barra sticky com contador (2–4) + tabela comparativa | máx 4 selecionáveis (bloqueio visível); ordem default por custo total efetivo; dado ausente = "—" |
| AddApartmentForm (Form) | aluguel / venda | campos + Select tipo + validação inline | default, error, submit (loading), sucesso (toast + limpa) |
| EmptyState | — | ilustração + copy real + CTA | quem não tem dados NUNCA vê tela em branco |
| Skeleton (kit #3) | shimmer | espelha a geometria final | `role="status"`; estático com reduced-motion |
| Toast (kit #1) | info/success | pill inferior central, auto-dismiss 3s | entrar/sair 0.3s; `aria-live="polite"` |
| Tooltip (kit hint) | — | dica curta em hover/foco | só-leitura |

Regras de componentes:
- Todo botão/input tem `focus-visible` com ring gold (invariante #3).
- Alvos: toque ≥ 44px; desktop ≥ 32px. Verificado no QC.
- `img` SEMPRE com `alt` descritivo/caption (a11y) e dimensões ou `aspect-ratio` fixos (zero CLS).
- Ícones Phosphor 24px; peso regular em metadados, duotone no CTA primário e no logo.

## 5. Elevation

| Nível | Sombra | Uso |
|---|---|---|
| 0 | none | Superfícies planas |
| 1 | `0 4px 12px -4px rgba(0,0,0,.4)` | Cards (default) |
| 2 | `0 20px 40px -15px rgba(0,0,0,.5)` | Cards hover, painéis |
| 3 | `0 8px 30px rgba(0,0,0,.45)` | Dialog, Toast, CompareBar (sticky) |

## 6. Motion (motion/react — já no projeto)

- Física padrão p/ modais/lightbox: `spring(320, 24)` (knob numérico — invariante #4).
- Easing p/ CSS puro: `cubic-bezier(0.4, 0, 0.2, 1)`; overshoot de mola só em micro-interações.
- Regras duras: animar SÓ `transform`/`opacity`; listas longas = stagger no container (cards já usam `index * 0.08`); **`prefers-reduced-motion` respeitado em 100% dos efeitos** (kit já cobre; Motion.js `useReducedMotion`).

## 7. Guidelines (do's & don'ts)

- ✅ Uma tarefa por superfície; primeira dobra decide (preço + essenciais).
- ✅ Valores monetários sempre Mono + Intl pt-BR; preço/m² computado (nunca armazenado).
- ✅ Contato só quando o dado existe; link do anúncio original sempre visível e clicável.
- ✅ "Não pague nada antes de visitar o imóvel pessoalmente" — regra de ouro fixa em todo modal com contato.
- ✅ Estimativas rotuladas "estimativa — confirmar com a imobiliária" (nunca como valor firme).
- ❌ Nada de "deve parecer bom" como spec — critério testável com número (seção 10).
- ❌ Sem hex solto/tamanho fora da escala/`dangerouslySetInnerHTML`.
- ❌ Sem dados inventados (condomínio desconhecido = `condoUnknown` + flag, nunca chute).
- ❌ Sem quebrar fluxo existente: suite completa roda antes de push; mudar comportamento antigo = teste de regressão.

## 8. Referências do projeto (galeria interna — 3 registradas)

1. **Minimal Gallery** (minimal.gallery) — estilo `minimal` / `dark`: densidade de informação baixa em dashboards premium. Inspiração.
2. **Uiverse — Toast/Badge/Skeleton** (uiverse.io, MIT) — padrão de auto-contido zero-dep que o kit do estúdio segue. Reuso de código.
3. **AppShot** (appshot.gallery) — filtro `mobile-app` × `professional` × `dark`: check de polimento de card/modal mobile. Inspiração.
4. **Padrão de processo (do plano de leva):** galeria viewer-first + thumbnails + lightbox zoom/pan (Zillow/Rightmove — menor bounce do setor). Inspiração de comportamento, código próprio.

## 9. Glossário do projeto (novos nomes — invariante #8)

| Nome | Definição (1 linha) | Sinônimos |
|---|---|---|
| Gallery | Carrossel de fotos do imóvel com principal + thumbs + contador + legenda | Carrossel, Fotos |
| Lightbox | Dialog em tela cheia para ver uma foto com zoom/pan | Viewer, Zoom view |
| AllInPanel | Painel de valores com custo total efetivo + estimativas de entrada/mudança | Custo all-in, painel de valores |
| VerifiedBadge | Selo com data e origem da verificação do anúncio | Selo verificado |
| VisitChecklist | Lista checável de pontos a conferir na visita, exportável | Checklist de visita |
| CompareTable | Tabela lado a lado de 2–4 imóveis ordenável | Comparação, side-by-side |
| CompareBar | Barra sticky com o contador de seleção para comparação | Barra de comparação |
| Regra de ouro | Frase fixa anti-golpe exibida junto ao contato | Aviso anti-golpe |

## 10. QC (checklist com números — roda na F7)

- [ ] Contraste AA verificado (axe): texto ≥ 4.5:1, UI ≥ 3:1 — zero falhas.
- [ ] `prefers-reduced-motion`: nenhum efeito anima quando ativo.
- [ ] Zero CLS: toda imagem com dimensões/`aspect-ratio`; `grep` sem `img` sem width/height.
- [ ] Fotos: galeria ≤ 350KB/arquivo; peso total por imóvel ≤ 3,5MB; lado maior ≥ 800px e lado menor ≥ 500px (orientation-aware: retrato usa a altura como eixo — S002 provou que o CDN entrega fit-in); 1ª `priority`, demais `lazy`.
- [ ] Alvos: touch ≥ 44px, desktop ≥ 32px (verificado por Playwright/computed style).
- [ ] Teclado: Esc fecha, ←/→ navega galeria, Tab percorre tudo, foco visível em todo elemento interativo.
- [ ] Zero erro de console no fluxo completo (Playwright).
- [ ] Valores: `grep` de literal monetário fora de `lib/constants.ts` = 0 (LL-006).
- [ ] Estados: toda lista tem skeleton/empty/error (grep por componente ausente = 0).
- [ ] Fluxo aluguel anterior: suite de regressão 100% verde (nunca quebrar o que funciona).
