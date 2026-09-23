---
version: 2.0
name: lagoscrib
description: Gestor pessoal de imóveis (aluguel + venda) em Curitiba — dashboard claro "Lightbox Analógico" (papel creme + amarelo táxi), contraste AAA, extremamente intuitivo, zero atrito. UI exibe estado; nunca é dona do estado.
stack: Next.js 16 App Router + Tailwind 4 + motion/react + Phosphor + Geist
colors:
  paper: "#FAF9F6"
  card: "#FFFFFF"
  sand: "#F3E9D7"
  ink: "#1A1A1A"
  ink-soft: "#4B5563"
  muted: "#57534E"
  accent: "#F5C518"
  accent-strong: "#E0B400"
  accent-soft: "#FDF096"
typography:
  display: { fontFamily: Geist, weight: 700 }
  body: { fontFamily: Geist, weight: 400 }
  mono: { fontFamily: Geist Mono, weight: 600 }
---

# DESIGN.md — lagoscrib

> Sistema de design para desenvolvimento assistido por IA. Fonte única de verdade visual.
> Última revisão: 2026-09-22 (v2.0 "Lightbox Analógico" — virou claro) | Dono: Gabriel | Revisão trimestral: sim
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

## 1. Colors (tokens reais — `app/globals.css` `@theme`, espelho em `THEME_PALETTE`)

**Conceito "Lightbox Analógico" (v2.0):** fundo papel creme quente (print analógico, não branco hospitalar), voz da marca em **amarelo táxi com tinta preta** (par AAA nativo: 10.68:1), pastéis quentes como superfícies de apoio. Exceção foto: scrim escuro SÓ sobre imagens (legibilidade da foto, padrão de portal).

| Token (Tailwind) | Hex | Papel | Contraste medido |
|---|---|---|---|
| `paper` | `#FAF9F6` | Fundo do app | — |
| `card` | `#FFFFFF` | Cards, modais, inputs | — |
| `sand` | `#F3E9D7` | Pastel de apoio (só com texto `ink`) | 14.46:1 com ink |
| `ink` | `#1A1A1A` | Texto principal | 16.53:1 no paper |
| `ink-soft` | `#4B5563` | Texto secundário | 7.18:1 no paper |
| `muted` | `#57534E` | Placeholder/label | 7.25:1 no paper |
| `taxi` | `#F5C518` | **Accent** (CTA, seleção, logo — texto sempre `ink`) | 10.68:1 com ink |
| `taxi-strong` | `#E0B400` | Accent hover/pressed | 8.87:1 com ink |
| `pastel` | `#FDF096` | Chip/badge de destaque (texto `ink`) | 14.99:1 com ink |
| `peach` / `water` | `#FFE3D1` / `#DDF3F0` | Pastéis reserva p/ status | 14.2–15.0:1 com ink |
| `amberink` | `#5F4100` | Links/texto âmbar (card, sand, paper) | 7.78–9.36:1 |
| `st-blue` / `st-blue-bg` | `#1E40AF` / `#DBEAFE` | Badge "agendado" | 7.15:1 |
| `st-purple` / `st-purple-bg` | `#6B21A8` / `#F3E8FF` | Badge "visita feita" | 7.39:1 |
| `st-green` / `st-green-bg` | `#14532D` / `#DCFCE7` | Badge "aprovado" | 8.30:1 |
| `st-red` / `st-red-bg` | `#7F1D1D` / `#FEE2E2` | Badge "recusado" + erro de login | 8.20:1 |
| `line` | `#E7E2D8` | Hairline decorativa (nunca único indicador) | — |
| `inputbd` | `#78716C` | Borda de input/checkbox | 4.80:1 no card |
| `night` | `#0B1121` | Scrim SÓ sobre fotos (texto `paper` por cima) | 18.81:1 com paper |

Regras:
- **NUNCA hex solto fora desta tabela** (invariante #2). Nova cor? Adicionar token aqui + `THEME_PALETTE` + revisão no PR.
- **AAA de verdade, com número:** texto normal ≥ 7:1, UI/borda ≥ 3:1 — travado em `tests/unit/lightbox-contrast.test.ts` (roda na suite; quebrou o piso = build vermelho, sem discussão).
- **Proibições documentadas** (o teste prova que falham): branco sobre `taxi` (1.63:1) e sobre `taxi-strong` (1.96:1) — CTA leva tinta preta, sem exceção. Anel de foco é `ink` (táxi sobre creme = 1.55:1, falha UI).
- Semânticas: `success`/`warning`/`danger` só em badge de status e validação — nunca reinventar por tela; badges pastel + texto escuro calibrado + label textual (estado nunca só por cor).

## 2. Typography (Geist + Geist Mono — já no `layout.tsx`)

| Papel | Família | Peso | Tamanho | Line-height | Uso |
|---|---|---|---|---|---|
| Display | Geist | 700 | clamp(1.5rem, 4vw, 2rem) | 1.1 | Título do dashboard |
| Heading | Geist | 600 | 1.125rem | 1.25 | Títulos de card/modal/aba |
| Body | Geist | 400 | 0.9375rem | 1.5 | Descrições, copy |
| Caption | Geist | 500 | 0.8125rem | 1.4 | Labels, metadados, legendas de foto |
| Mono | Geist Mono | 600 | 0.9375rem | 1.25 | **Valores monetários, preço/m², contadores** |

Regras: escala fixa (5 papeis, nada de tamanho arbitrário); valores monetários SEMPRE Mono (consistência de leitura); texto normal ≥ 7:1 (AAA), UI ≥ 3:1.

## 3. Spacing & shapes

- Base: 4px. Escala: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 — valor fora = erro de review.
- Raios: inputs/buttons `rounded-lg` (8px), cards/panels `rounded-2xl` (16px), badges/pills `rounded-full`, thumbnails `rounded-xl` (12px); kanban full-viewport (`ProfileModal`) ocupa a tela cheia sem raio externo.
- Largura: conteúdo `max-w-7xl` no dashboard; modal `max-w-2xl`; kanban em tela cheia (`ProfileModal` full-viewport, board estático sem scroll em lg+ com scroll de fallback abaixo de lg); lightbox full screen escuro; shells mobile-first (colunas empilham < 640px).

## 4. Components (nomes oficiais do Glossário + novos registrados)

> Nomeação do glossário do estúdio: Badge ≠ Chip; Dialog = bloqueia tela; Toast = some sozinho; Toggle = switch imediato. Novos componentes entram na seção 9.

| Componente | Variantes | Anatomia (tokens) | Estados obrigatórios |
|---|---|---|---|
| Button | primary / secondary / ghost | primary: `bg-taxi text-ink` (hover `taxi-strong`); ghost: `border-inputbd text-ink` | default, hover, active, disabled (+motivo), loading, focus-visible ring ink |
| Input + Select | default / error | `bg-card border-inputbd rounded-lg px-3 h-11` | default, focus (borda ink + sombra ink/12), error (+mensagem inline), disabled |
| Toggle (kit #4) | Alugar\|Comprar | pill 48×28, knob branco, accent quando on, `role="switch"` | checked/unchecked, focus-visible, reduced-motion |
| StatusBadge (kit #2) | tom ok/warn/accent por status | pill 13px semibold pastel + texto escuro calibrado (todos ≥ 7:1) | estático; acessível via `aria-label` quando só-icone |
| VerifiedBadge | "Verificado em {data} · {origem}" | texto `amberink` + ícone ✓ | estático; tooltip com data exata |
| Card (ApartmentCard) | mínimo: foto + badge + preço + bairro + 4 stats + Comparar | `bg-card`, `rounded-2xl`, borda `line`, hover translateY(-4px) + brilho táxi; SEM links/endereço/facilidades/Prospectar (vivem no modal) | default, hover (clicável), focus-visible; **loading = skeleton com a MESMA geometria** |
| KanbanCard (pílula) | miniatura 40px + título/bairro 1 linha + preço mono + selo; menu Mover…/Contatei/Retornou | `bg-card`, `rounded-xl`, borda `line`; selo `bg-pastel`/`bg-st-green-bg` (pares travados); coluna trava em `KANBAN_VISIBLE_CAP` + rodapé "+N restantes" (dialog jump-list) | default, focus-visible; teclado `,`/`.`/`<`/`>` + Enter/Esc; board estático sem scroll (lg+) |
| Dialog (DetailModal) | Detalhes \| Notas \| Checklist \| Planta (Tabs) | overlay `night/60` + panel `bg-card max-w-2xl` | `role="dialog"` + `aria-modal` + foco no painel ao abrir (restaura gatilho) + scroll-lock + Esc; open/close com spring; rolável |
| Gallery (Carousel) | — | principal 4:3 `object-cover` + thumbs (lazy) + setas ◀▶ + contador "3/12" + legenda | 1ª photo priority; thumbs lazy; swipe mobile; ←/→ teclado; empty (0 fotos → capa + aviso) |
| Lightbox (Dialog) | — | fullscreen escuro (`night/95`); zoom clique/scroll/pinch; pan arrastar | open/close; Esc; contador; reduced-motion desativa zoom animado |
| AllInPanel | aluguel / venda | painel com linhas aluguel/cond/IPTU + "Entrada estimada" + "Mudança estimada" | rotulado "estimativa — confirmar com a imobiliária"; venda: preço + cond + IPTU + preço/m² |
| VisitChecklist | — | lista de itens com checkbox + botões "Copiar" / "WhatsApp" | TDD: marca→persiste; copy→toast; lista vazia→empty state |
| CompareBar + CompareTable (Table) | — | barra sticky com contador (2–4) + tabela comparativa | máx 4 selecionáveis (bloqueio visível); ordem default por custo total efetivo; dado ausente = "—" |
| AddApartmentForm (Form) | aluguel / venda | abre em modal (overlay `night/60` + `role="dialog"`, Esc, scroll-lock, foco no 1º campo); campos + Select tipo + validação inline | default, error, submit (loading), sucesso (toast + limpa) |
| EmptyState | — | ilustração + copy real + CTA | quem não tem dados NUNCA vê tela em branco |
| Skeleton (kit #3) | shimmer | espelha a geometria final | `role="status"`; estático com reduced-motion |
| Toast (kit #1) | info/success | pill inferior central, auto-dismiss 3s | entrar/sair 0.3s; `aria-live="polite"` |
| Tooltip (kit hint) | — | dica curta em hover/foco | só-leitura |

Regras de componentes:
- Todo botão/input tem `focus-visible` com ring `ink` (invariante #3).
- Alvos: toque ≥ 44px; desktop ≥ 32px. Verificado no QC.
- `img` SEMPRE com `alt` descritivo/caption (a11y) e dimensões ou `aspect-ratio` fixos (zero CLS).
- Ícones Phosphor 24px; peso regular em metadados, duotone no CTA primário e no logo.

## 5. Elevation (tema claro: sombras suaves e quentes)

| Nível | Sombra | Uso |
|---|---|---|
| 0 | none | Superfícies planas (paper) |
| 1 | `0 1px 2px rgba(26,26,26,.05)` + `shadow-sm` | Cards (default), toggles |
| 2 | `0 20px 40px -15px rgba(26,26,26,.18)` | Cards hover, painéis |
| 3 | `shadow-xl` / `shadow-2xl` | Dialog, login card, CompareBar (sticky) |

## 6. Motion (motion/react — já no projeto)

- Física padrão p/ modais/lightbox: `spring(320, 24)` (knob numérico — invariante #4).
- Easing p/ CSS puro: `cubic-bezier(0.4, 0, 0.2, 1)`; overshoot de mola só em micro-interações.
- Regras duras: animar SÓ `transform`/`opacity`; listas longas = stagger com cap via `cardStaggerDelay(index)` (`lib/motion.ts`, cap default 12 — sem fila de segundos); `MotionConfig reducedMotion="user"` no `MotionProvider`; **`prefers-reduced-motion` respeitado em 100% dos efeitos** (kit já cobre; Motion.js `useReducedMotion`).

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

## 8. Referências do projeto (galeria interna — 6 registradas)

1. **Minimal Gallery** (minimal.gallery) — estilo `minimal` / `dark`: densidade de informação baixa em dashboards premium. Inspiração.
2. **Uiverse — Toast/Badge/Skeleton** (uiverse.io, MIT) — padrão de auto-contido zero-dep que o kit do estúdio segue. Reuso de código.
3. **AppShot** (appshot.gallery) — filtro `mobile-app` × `professional` × `dark`: check de polimento de card/modal mobile. Inspiração.
4. **Padrão de processo (do plano de leva):** galeria viewer-first + thumbnails + lightbox zoom/pan (Zillow/Rightmove — menor bounce do setor). Inspiração de comportamento, código próprio.
5. **Padrão portal claro BR (QuintoAndar/ZAP/VivaReal):** fundo claro + foto protagonista + confiança por "luz natural". Convenção do setor que a v2.0 adota. Inspiração de comportamento.
6. **Par amarelo/preto editorial (Ikea/Best Buy/Wizz Air):** acento único de alta energia com texto preto — par AAA nativo (10–20:1). Base do `taxi` + `ink` da v2.0. Inspiração de cor.

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

- [ ] Contraste AAA automatizado: `tests/unit/lightbox-contrast.test.ts` verde — texto ≥ 7:1, UI ≥ 3:1, pares proibidos documentados. Zero falhas.
- [ ] `prefers-reduced-motion`: nenhum efeito anima quando ativo (kill-switch global em `globals.css` + `useReducedMotion`).
- [ ] Zero CLS: toda imagem com dimensões/`aspect-ratio`; `grep` sem `img` sem width/height.
- [ ] Fotos: galeria ≤ 350KB/arquivo; peso total por imóvel ≤ 3,5MB; lado maior ≥ 800px e lado menor ≥ 500px (orientation-aware: retrato usa a altura como eixo — S002 provou que o CDN entrega fit-in); 1ª `priority`, demais `lazy`.
- [ ] Alvos: touch ≥ 44px, desktop ≥ 32px (verificado por Playwright/computed style).
- [ ] Teclado: Esc fecha, ←/→ navega galeria, Tab percorre tudo, foco visível em todo elemento interativo.
- [ ] Zero erro de console no fluxo completo (Playwright).
- [ ] Valores: `grep` de literal monetário fora de `lib/constants.ts` = 0 (LL-006).
- [ ] Estados: toda lista tem skeleton/empty/error (grep por componente ausente = 0).
- [ ] Fluxo aluguel anterior: suite de regressão 100% verde (nunca quebrar o que funciona).
