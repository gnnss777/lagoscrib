# UX Spec — Kanban de Prospecção (leva kanban-prospeccao + tela-inteira-ui)

> Status: IMPLEMENTED (22/09/2026 — branch `feat/kanban-prospeccao`).
> Adendo TELA-CHEIA (22/09/2026, plano `lagoscrib-kanban-tela-inteira-ui.md`):
> board sai do diálogo e vira view full-viewport; Stats bar da home removida;
> slider duplo de preço; CTAs pill. Seções alteradas marcadas com [TELA-CHEIA].
> Regras-mãe: plano `lagoscrib-kanban-correcao-intuitivo.md` + decisões WS-A
> (`lagoscrib-kanban-central-agregadora.md` §2.4/§3: sem lib de drag, schema
> aditivo, mover por botões/menu + teclado) + camada AAA + DESIGN.md v2
> (Lightbox Analógico: paper/taxi/ink, pares ≥7:1 travados).

## Superfície [TELA-CHEIA]

- Header do Dashboard: botão pill **"Prospecção"** (`KANBAN_TAB_LABEL`, visível
  também no mobile) + "Olá, {username}" (desktop) → abrem a **view tela cheia**
  (`ProfileModal`, `fixed inset-0 z-50`, `role="dialog"`, `data-testid="kanban-view"`).
- View tem header próprio (voltar ← p/ busca, engrenagem "Configurar quadro",
  fechar ×, Esc fecha/volta); sem abas — board sempre visível. Clique no card
  abre o `DetailModal` atual (zero duplicação de detalhe).
- Board respeita a **aba ativa** (Alugar | Comprar) — mesmos dados do dashboard
  via `lib/pool.ts` (pool único, fecha B2).
- Home SEM Stats bar (removida — duplicava o funil): header mantém
  "N apartamentos encontrados".

## Colunas e cards [TELA-CHEIA]

- 6 colunas na ordem do pipeline (`KANBAN_COLUMNS`, fonte única em `lib/kanban.ts`):
  Não visitado → Visita agendada → Visita feita → Em negociação → Aprovado → Recusado.
- Scroll horizontal em 100vw (`w-max min-w-full`), coluna `w-72 sm:w-80` com
  scroll vertical próprio (`max-h-[calc(100vh-230px)]`); header com **contagem**
  (`aria-label "N imóveis em {coluna}"`) + alerta textual quando há pendentes
  ("N sem retorno há 7+ dias", `FOLLOWUP_STALE_DAYS`).
- Card: foto (h-28), título/bairro/preço (`formatBRL`), **selo de retorno na dobra
  superior** (AC-3: `bg-pastel` + ícone + "sem retorno ×N", 14.99:1; retornou =
  verde + ✓), última ação (data do último contato). Coluna vazia: hint
  (`KANBAN_EMPTY_COLUMN_HINT`).
- Todo imóvel do pool tem posição (default Não visitado/fim); mover cria a entrada
  de status — nunca há card "fora do quadro".

## Mover (AC-1: ≤2 ações, AC-2: 100% teclado, sem drag)

- Controles por card: **← / →** (coluna anterior/próxima, `disabled` nos extremos)
  + botão **"Mover…"** (`aria-haspopup="menu"`, `aria-expanded`) → menu WAI-ARIA
  (`role="menu"`) com destinos × posição (topo/fim, `role="menuitem"`).
- Teclado no card (`tabIndex={0}`, Enter abre o menu, Esc fecha): `,`/`.` move de
  coluna (estilo Trello), `<`/`>` topo/fim da coluna.
- **`aria-live="polite"` policial**: "Card {título} movido para {coluna}
  (posição X de N)" — fecha B6.

## Retorno do corretor (fecha B3 — dor #4)

- Botões por card: **"Contatei"** (incrementa ×N, trava após "retornou") e
  **"Retornou ✓"** (preserva histórico de tentativas + última data).
- Filtro rápido: **"Só sem retorno (N)" / "Mostrar todos"** (`aria-pressed`).

## Prospectar (AC-5: ≤2 ações)

- Botão **"Prospectar →"** no `DetailModal` (seção Status) — o `ApartmentCard` é mínimo e NÃO tem Prospectar (F3.1):
  joga o imóvel p/ o topo de Não visitado e abre o Perfil na Prospecção.
  Reversível (mover de volta — nunca exclui da base).

## Data da visita (regressão B1)

- `DetailModal` inicializa o input com a data salva (`getStatusEntry`).
- `updateStatus` preserva `scheduledDate` ao trocar de status; limpar só pela
  ação explícita "limpar data" (`null` ≠ `undefined` no contrato).
- Data visível também em "Visita feita" como histórico.

## Customização do cliente (AC-9) [TELA-CHEIA]

- Painel lateral **Configurar quadro** (engrenagem no header, `aria-expanded`,
  `role="complementary"`): renomear (Enter/blur, vazio = volta ao padrão),
  subir/descer, ocultar/mostrar (`aria-pressed`), **"Voltar ao padrão"**.
- Persistência em chave própria `apartamentos-app-kanban-cols` v1 (só UI —
  nunca estado do imóvel); lixo/versão velha → default exato; reload preserva.

## Slider de preço [TELA-CHEIA]

- `PriceRangeSlider` no lugar dos inputs numéricos mín/máx: slider duplo com
  trilho + trecho ativo `bg-taxi` entre os thumbs, chips de valor ao vivo
  (`aria-live`, "Sem mín"/"Sem máx" nos extremos).
- Mesmos campos `FilterState.priceMin/priceMax` (schema intacto);
  lógica em `lib/priceSlider.ts` (linear aluguel 0–20k/400 passos;
  log venda 0–35M/380 passos, piso `PRICE_SLIDER_SALE_FLOOR`).
- AAA: thumbs nativos (`role="slider"`, setas/Home/End sem handler),
  `aria-valuetext` em BRL, foco visível no thumb, altura tocável `h-11`.

## Pílulas premium [TELA-CHEIA]

- `rounded-full` nos CTAs: `.btn-primary`/`.btn-secondary` (global, cobre
  Entrar), Mais filtros, tabs Alugar/Comprar, Prospectar, Comparar/Limpar,
  ações do kanban (Mover…, Contatei, Retornou ✓), tabs do DetailModal.
  Nenhum par novo de cor (contraste travado intacto).

## Acessibilidade AAA (regras duras, verificáveis no e2e)

- Todo interativo `min-h-11` (botões de menu topo/fim `min-h-9` dentro do menu
  denso — alvos adjacentes com texto, WCAG 2.5.8); foco visível `ring-ink`.
- Estado nunca só por cor: selo tem ícone + texto; alerta da coluna é textual;
  contagens têm `aria-label`.
- Contraste: pares novos em `THEME_CONTRAST_TEXT` (selo/alerta ≥7:1) — trava
  `lightbox-contrast.test.ts` cobre sem alteração de teste.

## ACs (números)

- AC-1: mover em ≤2 ações (←/→ = 1; menu = abrir + escolher).
- AC-2: 100% por teclado — `e2e/kanban.spec.ts` (foco + `.` + aria-live).
- AC-3: selo na dobra superior do card (foto h-28, selo `top-2 left-2`).
- AC-4: v1/v2 legíveis (`migrateStoredState`, teste unit + e2e legado inalterado*).
- AC-5: prospectar = 1 clique no card + Perfil aberto (spec dedicado).
- AC-6: pares novos ≥7:1 na trava de contraste.
- AC-7: agendado→feita→agendado preserva a data (unit + `moveCard clearDate`).
- AC-8: `toSyncFollowUps` passa 100% no `syncPushSchema` (unit, 2 entradas).
- AC-9: rename + reload preserva; reset volta aos 6 (spec dedicado).
- AC-U1: Stats bar removida (sem `grid-cols-3 sm:grid-cols-6` nem memo `stats`).
- AC-U2: view `fixed inset-0` 100vw, coluna com scroll vertical próprio
  (spec: largura ≥900px + regions visíveis).
- AC-U3: painel lateral com renomear/reordenar/ocultar/reset (spec dedicado).
- AC-U4: slider escreve `priceMin/Max` com `clampRange` (unit + spec teclado).
- AC-U5: round-trip linear ≤1 posição; log ≤5% relativo (unit).
- AC-U6: 2 sliders/aba com nomes distintos + `aria-valuetext` BRL (spec).
- AC-U7: CTAs `rounded-full`, contraste travado 100% (unit contraste intacto).
- AC-U8: typecheck + lint 0/0 + unit + build + e2e kanban/slider verdes.

\* Nota honesta 22/09/2026: `persistencia/smoke/filtros/venda` falham **no HEAD
sem esta leva** (`Expected: 7, Received: 57` — base 7→57 da expansão 5-fontes).
Staleness pré-existente, fora deste escopo; prova por stash registrada na evidência.

## Notas de implementação

- Lógica em `lib/kanban.ts` (pura, imutável; `moveCard` reindexa só colunas
  tocadas) — componente só chama e renderiza. `buildColumns` ordena por
  `index` (ausente = fim, estável por `updatedAt`).
- `lib/pool.ts` extraído do `Dashboard.getAllApartments` (dedupe por id,
  `transaction` default "aluguel", try/catch → estáticos).
- Sync segue DEFERRED: só contrato (`toSyncFollowUps` + teste de pull mapping).
  Descoberta: `syncPushSchema` rejeita `urlOriginal: ""` (`.url()` não aceita
  vazia) → campo **omitido** quando desconhecido; migração futura deve repetir
  o padrão (nunca enviar string vazia).

## Estático sem scroll [ESTÁTICO-SEM-SCROLL 23/09/2026]

> Muda o contrato de scroll: board e colunas **sem nenhum scroll** (lg+);
> abaixo de lg, scroll horizontal/vertical de fallback (mobile segue usável).
> SUPERSEDE: AC-U2 (coluna com scroll próprio) e AC-3 (foto h-28 + selo na
> dobra) — o resto dos ACs continua valendo.

- Card vira **pílula compacta** (`FollowUpSeal` + trava em `lib/kanban.ts`):
  miniatura 40px + título/bairro numa linha truncada + preço `formatBRL`
  mono; terceira linha só com selo (`sem retorno ×N`/`retornou`, mesmos pares
  de cor travados) ou último contato. Sem botões visíveis — mover/contato
  vivem no menu do card (abrir + escolher = ≤2 ações, AC-1 intacto) e no
  teclado `,`/`.`/`<`/`>` (AC-2 intacto).
- **Trava física** `KANBAN_VISIBLE_CAP = 7` (`lib/constants.ts`, fonte única —
  LL-006): pílula ≈60px + gap 6px → 7 cabem em ~470px; + header/rodapé ≈
  590px, dentro dos ~592px úteis em 768p. `splitColumnOverflow` (pura,
  imutável, com unit) divide visíveis/ocultos; contagens e `aria-labels`
  usam sempre o total (nunca mentem).
- **Overflow = rodapé "+N restantes"** por coluna
  (`aria-label "Mostrar N imóveis ocultos em {coluna}"`) → abre dialog
  (`role="dialog"` + `aria-modal`, foco no painel, restaura gatilho, Esc
  fecha **só o dialog** — guarda no Esc da view; jump-list: clique abre o
  detalhe e fecha a lista). Dialog com scroll interno (padrão DetailModal —
  o "sem scroll" vale para a página do board, não para dialogs transitórios).
- Layout: board `flex h-full` + linha `flex-1 items-stretch` + colunas
  `flex-1 min-w-0 overflow-hidden` (lg+); view mantém `kanban-view`,
  `region` por coluna, `formatBRL`, foco/Esc/scroll-lock.

## ACs (adendo ESTÁTICO-SEM-SCROLL)

- AC-U9: board e colunas sem scroll interno (lg+) — `e2e/kanban.spec.ts`
  (`test_kanban_estatico_sem_scroll_contador_mais`: coluna
  `scrollHeight ≤ clientHeight`, contador `+\d+ restantes`, dialog abre,
  Esc fecha só o dialog).
- AC-U10: trava `KANBAN_VISIBLE_CAP` com unit (`splitColumnOverflow`:
  abaixo/acima do cap + cap zerado) e contagens sempre totais.
