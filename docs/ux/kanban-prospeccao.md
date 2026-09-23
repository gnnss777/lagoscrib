# UX Spec — Kanban de Prospecção (leva kanban-prospeccao)

> Status: IMPLEMENTED (22/09/2026 — branch `feat/kanban-prospeccao`).
> Regras-mãe: plano `lagoscrib-kanban-correcao-intuitivo.md` + decisões WS-A
> (`lagoscrib-kanban-central-agregadora.md` §2.4/§3: sem lib de drag, schema
> aditivo, mover por botões/menu + teclado) + camada AAA + DESIGN.md v2
> (Lightbox Analógico: paper/taxi/ink, pares ≥7:1 travados).

## Superfície

- Header do Dashboard: "Olá, {username}" é **botão** (`aria-haspopup="dialog"`)
  → abre o **Perfil** (`ProfileModal`, `role="dialog"`, Esc fecha).
- Perfil tem 2 abas (`role="tablist"`): **Prospecção** (principal, `KANBAN_TAB_LABEL`)
  e **Configurar quadro**. Clique no card do kanban abre o `DetailModal` atual
  (zero duplicação de detalhe).
- Board respeita a **aba ativa** (Alugar | Comprar) — mesmos dados do dashboard
  via `lib/pool.ts` (pool único, fecha B2).

## Colunas e cards

- 6 colunas na ordem do pipeline (`KANBAN_COLUMNS`, fonte única em `lib/kanban.ts`):
  Não visitado → Visita agendada → Visita feita → Em negociação → Aprovado → Recusado.
- Scroll horizontal em `overflow-x-auto`, coluna `w-72`; header com **contagem**
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

- Botão **"Prospectar →"** no `ApartmentCard` e no `DetailModal` (seção Status):
  joga o imóvel p/ o topo de Não visitado e abre o Perfil na Prospecção.
  Reversível (mover de volta — nunca exclui da base).

## Data da visita (regressão B1)

- `DetailModal` inicializa o input com a data salva (`getStatusEntry`).
- `updateStatus` preserva `scheduledDate` ao trocar de status; limpar só pela
  ação explícita "limpar data" (`null` ≠ `undefined` no contrato).
- Data visível também em "Visita feita" como histórico.

## Customização do cliente (AC-9)

- Aba **Configurar quadro**: renomear (Enter/blur, vazio = volta ao padrão),
  subir/descer, ocultar/mostrar (`aria-pressed`), **"Voltar ao padrão"**.
- Persistência em chave própria `apartamentos-app-kanban-cols` v1 (só UI —
  nunca estado do imóvel); lixo/versão velha → default exato; reload preserva.

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
