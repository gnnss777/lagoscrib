"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  DotsThree,
  Phone,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import {
  buildWhatsAppConfirm,
  buildWhatsAppLink,
  formatBRL,
} from "@/lib/antiDores";
import {
  FOLLOWUP_STALE_DAYS,
  KANBAN_CONTACT_LABEL,
  KANBAN_EMPTY_COLUMN_HINT,
  KANBAN_ONLY_STALE_LABEL,
  KANBAN_RETURNED_LABEL,
  KANBAN_SHOW_ALL_LABEL,
  KANBAN_VISIBLE_CAP,
} from "@/lib/constants";
import {
  buildColumns,
  columnLabel,
  countHanging,
  isHanging,
  isKanbanExcludedStatus,
  splitColumnOverflow,
  toKanbanStatus,
  type ApartmentStatus,
  type ColumnConfig,
  type FollowUp,
  type KanbanColumn,
  type StatusType,
} from "@/lib/kanban";
import { useApp } from "@/lib/AppContext";
import ApartmentCard from "./ApartmentCard";

interface KanbanBoardProps {
  apartments: Apartment[];
  colConfig: ColumnConfig;
  onSelect: (apartment: Apartment) => void;
}

// Atalhos estilo Trello (sem lib de drag): ,/. move de coluna, </> topo/fim.
function moveShortcut(
  key: string,
  status: StatusType,
  order: StatusType[],
): { to: StatusType; toIndex?: number } | null {
  const i = order.indexOf(status);
  if (key === "," && i > 0) return { to: order[i - 1] };
  if (key === "." && i >= 0 && i < order.length - 1) return { to: order[i + 1] };
  if (key === "<") return { to: status, toIndex: 0 };
  if (key === ">") return { to: status };
  return null;
}

// Slot de inserção a partir do cursor (leva kanban-drag-drop): metade de
// cima do card = antes, metade de baixo = depois (padrão Trello). O índice
// é calculado entre os cards VISÍVEIS da coluna (data-kanban-card).
function slotFromPoint(
  container: HTMLElement,
  status: StatusType,
  clientY: number,
): { status: StatusType; index: number } {
  const cards = Array.from(
    container.querySelectorAll<HTMLElement>("[data-kanban-card]"),
  );
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect();
    if (clientY >= r.top && clientY <= r.bottom) {
      const after = clientY > r.top + r.height / 2;
      return { status, index: i + (after ? 1 : 0) };
    }
  }
  if (cards.length === 0) return { status, index: 0 };
  const first = cards[0].getBoundingClientRect();
  if (clientY < first.top) return { status, index: 0 };
  return { status, index: cards.length };
}

/**
 * Colunas do quadro para um conjunto de imóveis: descarta status fora do
 * funil (descartado/inativo), mapeia visita→agendado e visitado→feita, e
 * sintetiza posição para quem ainda não tem status (default "novo", no fim).
 *
 * Mora aqui (e não no núcleo) porque é a VISUALIZAÇÃO. O KanbanSection
 * precisa das mesmas contagens por etapa para o filtro de coluna do painel —
 * duas cópias dessa regra divergem, então há uma só.
 */
export function kanbanColumns(
  apartments: Apartment[],
  statuses: ApartmentStatus[],
  followUps: Record<string, FollowUp>,
  cfg: ColumnConfig,
): KanbanColumn[] {
  const entriesByApartmentId = new Map<string, ApartmentStatus>();
  for (const apartment of apartments) {
    const found = statuses.find(
      (status) => status.apartmentId === apartment.id,
    );
    if (found && isKanbanExcludedStatus(found.status)) continue;
    const mapped = found ? toKanbanStatus(found.status) : null;
    entriesByApartmentId.set(
      apartment.id,
      found
        ? { ...found, ...(mapped ? { status: mapped } : {}) }
        : {
            apartmentId: apartment.id,
            status: "novo" as const,
            updatedAt: "",
            index: Number.MAX_SAFE_INTEGER,
          },
    );
    if (found && !mapped) entriesByApartmentId.delete(apartment.id);
  }
  return buildColumns(
    [...entriesByApartmentId.values()],
    followUps,
    cfg,
  );
}

/**
 * Índice REAL da coluna a partir do slot VISUAL (leva kanban-filtros).
 *
 * `slotFromPoint` conta só o que está na tela (`visibleIds`: filtro de
 * staleOnly, cap do "+N restantes" e agora os filtros do quadro). Com filtro
 * ligado o índice visual deixa de bater com o índice real e o card cai na
 * posição errada. Aqui o slot vira posição na lista REAL da coluna, que é o
 * que `moveCard` consome: o destino é o card visível que deve ficar DEPOIS
 * da inserção (ou o fim da coluna), e o `moveCard` já remove a entrada
 * antiga antes de aplicar o índice.
 *
 * Detalhe que custa um bug: o `toIndex` do `moveCard` é comparado com o
 * campo `index` das entradas restantes, não com a posição no array. Arrastar
 * DENTRO da própria coluna abre um buraco na sequência de `index`, então a
 * posição do âncora no array já sem o card arrastado não serve — a posição
 * dela na coluna CHEIA é a que vale, porque é igual ao `index` que o
 * `moveCard` vai empurrar.
 *
 * Sem filtro (`visibleIds === columnIds`) isto degenera no índice antigo.
 */
export function realIndexFromVisual(
  columnIds: string[],
  visibleIds: string[],
  draggedId: string | null,
  visualIndex: number,
): number {
  const rest = draggedId
    ? columnIds.filter((id) => id !== draggedId)
    : columnIds;
  const shown = draggedId
    ? visibleIds.filter((id) => id !== draggedId)
    : visibleIds;
  // O card arrastado continua na tela (opacity-50), então o slot visual o
  // conta. Depois de removê-lo da lista, tudo abaixo dele escorrega -1.
  const dragAt = draggedId ? visibleIds.indexOf(draggedId) : -1;
  const at = dragAt >= 0 && visualIndex > dragAt ? visualIndex - 1 : visualIndex;
  // Fim da coluna: `moveCard` empurra quem está >= at, e o último índice real
  // da coluna é rest.length - 1, então o fim é rest.length.
  if (at >= shown.length) return rest.length;
  const target = columnIds.indexOf(shown[at]);
  return target < 0 ? rest.length : target;
}

// Linha de selo do follow-up (AC-3: texto visível, nunca só cor).
// Reusada na pílula da coluna e na lista do "+N restantes".
function FollowUpSeal({ fu }: { fu: FollowUp | undefined }) {
  if (fu && fu.status === "aguardando" && fu.attempts > 0) {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-pastel px-1.5 py-px text-xs font-bold text-ink">
        <Phone size={12} weight="bold" />
        sem retorno ×{fu.attempts}
      </span>
    );
  }
  if (fu?.status === "retornou") {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-st-green-bg px-1.5 py-px text-xs font-bold text-st-green">
        <Check size={12} weight="bold" />
        retornou
      </span>
    );
  }
  if (fu?.lastContactAt) {
    return (
      <span className="mt-0.5 block truncate text-xs text-muted">
        último contato{" "}
        {new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }).format(new Date(fu.lastContactAt))}
      </span>
    );
  }
  return null;
}

function KanbanCardDetail({
  apartment,
  onClose,
}: {
  apartment: Apartment;
  onClose: () => void;
}) {
  const [compareChecked, setCompareChecked] = useState(false);

  return (
    // stopPropagation: o <article> externo alterna o detalhe ao clicar. Sem
    // isto, clicar no X (ou no card dentro do detalhe) fecha e reabre na
    // mesma hora — o card fica preso aberto.
    <div
      data-kanban-card-detail
      className="p-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-line px-1 pb-1.5">
        <span className="truncate text-xs font-semibold text-ink">
          {apartment.title}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={buildWhatsAppLink(
              apartment.phone,
              buildWhatsAppConfirm(apartment),
            )}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir WhatsApp sobre ${apartment.title}`}
            data-kanban-whatsapp
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand hover:text-ink"
          >
            <WhatsappLogo
              size={18}
              weight="fill"
              className="text-st-green"
            />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Fechar detalhes de ${apartment.title} (Esc)`}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand hover:text-ink"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
      </div>
      <ApartmentCard
        apartment={apartment}
        index={0}
        onSelect={onClose}
        compareChecked={compareChecked}
        onToggleCompare={() => setCompareChecked((value) => !value)}
      />
    </div>
  );
}

export default function KanbanBoard({
  apartments,
  colConfig,
  onSelect,
}: KanbanBoardProps) {
  const {
    statuses,
    followUps,
    moveCardTo,
    markContact,
    markReturned,
  } = useApp();
  const [staleOnly, setStaleOnly] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  // Fallback do cap: qual coluna abriu o "+N restantes".
  const [overflowFor, setOverflowFor] = useState<StatusType | null>(null);
  const overflowTrigger = useRef<HTMLElement | null>(null);
  const overflowPanelRef = useRef<HTMLDivElement>(null);

  // --- Drag & drop nativo (leva kanban-drag-drop): HTML5, sem lib nova. ---
  const [dragId, setDragIdState] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<{
    status: StatusType;
    index: number;
  } | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const dropSlotRef = useRef<{ status: StatusType; index: number } | null>(null);

  const setDragId = (id: string | null) => {
    dragIdRef.current = id;
    setDragIdState(id);
  };
  const setSlot = (slot: { status: StatusType; index: number } | null) => {
    dropSlotRef.current = slot;
    setDropSlot(slot);
  };

  useEffect(() => {
    if (!expandedCardId) return;
    const closeExpandedCard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setMenuFor(null);
      setExpandedCardId(null);
    };
    window.addEventListener("keydown", closeExpandedCard, true);
    return () =>
      window.removeEventListener("keydown", closeExpandedCard, true);
  }, [expandedCardId]);

  const byId = useMemo(() => {
    const unique = new Map<string, Apartment>();
    for (const apartment of apartments) {
      const status = statuses.find((s) => s.apartmentId === apartment.id)?.status;
      if (status && isKanbanExcludedStatus(status)) continue;
      unique.set(apartment.id, apartment);
    }
    return unique;
  }, [apartments, statuses]);

  // Entradas sintetizadas: todo imóvel do pool tem posição (default = novo/fim).
  const columns = useMemo(
    () => kanbanColumns([...byId.values()], statuses, followUps, colConfig),
    [byId, statuses, followUps, colConfig],
  );

  // O que está DE FATO na tela, por coluna: filtro de staleOnly + cap do
  // "+N restantes". Fonte única do DOM e da matemática do drop — se o
  // slotFromPoint mede a tela e o commitDrop mede outra lista, o card cai
  // na posição errada (leva kanban-filtros).
  const renderedByStatus = useMemo(() => {
    const out: Partial<
      Record<StatusType, { visible: string[]; hidden: string[] }>
    > = {};
    for (const col of columns) {
      const ids = staleOnly
        ? col.ids.filter((id) => isHanging(followUps[id], FOLLOWUP_STALE_DAYS))
        : col.ids;
      out[col.status] = splitColumnOverflow(ids, KANBAN_VISIBLE_CAP);
    }
    return out;
  }, [columns, staleOnly, followUps]);

  const emptyColumn = { visible: [] as string[], hidden: [] as string[] };

  const visibleOrder = useMemo(
    () => columns.map((column) => column.status),
    [columns],
  );

  const move = (
    apartmentId: string,
    to: StatusType,
    toIndex?: number,
  ) => {
    moveCardTo(apartmentId, to, toIndex);
    const a = byId.get(apartmentId);
    const col = columns.find((c) => c.status === to);
    const pos = toIndex ?? (col ? col.ids.length : 0);
    const total = (col ? col.ids.length : 0) + 1;
    setAnnounce(
      `Card ${a?.title ?? apartmentId} movido para ${columnLabel(to, colConfig)} (posição ${pos + 1} de ${total})`,
    );
    setMenuFor(null);
  };

  // Commit do drop (leva kanban-drag-drop): traduz o slot VISUAL para o
  // índice REAL da coluna. Com filtro ligado os dois indices divergem —
  // usar o visual aqui gravava o card na posição errada. No-op se não mudou.
  const commitDrop = () => {
    const id = dragIdRef.current;
    const slot = dropSlotRef.current;
    setDragId(null);
    setSlot(null);
    if (!id || !slot) return;
    const col = columns.find((c) => c.status === slot.status);
    if (!col) return;
    const target = realIndexFromVisual(
      col.ids,
      renderedByStatus[slot.status]?.visible ?? [],
      id,
      slot.index,
    );
    if (col.ids[target] === id) return;
    move(id, slot.status, target);
  };

  const staleTotal = useMemo(
    () => countHanging(followUps, FOLLOWUP_STALE_DAYS),
    [followUps],
  );

  // Ids ocultos da coluna com o dialog "+N restantes" aberto — mesma
  // lista renderizada que a coluna mostra, então a conta sempre fecha.
  const overflowIds = useMemo(() => {
    if (!overflowFor) return [];
    return renderedByStatus[overflowFor]?.hidden ?? [];
  }, [overflowFor, renderedByStatus]);
  const overflowLabel = overflowFor ? columnLabel(overflowFor, colConfig) : "";

  // Dialog a11y (padrão DetailModal): foco no painel ao abrir +
  // restaura o gatilho ao fechar; Esc fecha só o dialog.
  useEffect(() => {
    if (!overflowFor) return;
    const trigger = document.activeElement as HTMLElement | null;
    overflowTrigger.current = trigger;
    overflowPanelRef.current?.focus();
    return () => {
      overflowTrigger.current?.focus();
    };
  }, [overflowFor]);

  useEffect(() => {
    if (!overflowFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverflowFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overflowFor]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Barra do board: seletor de "sem retorno" + resumo. O filtro de
          coluna (com contagem por etapa) é do KanbanSection — fica ao lado
          do board, não aqui dentro. */}
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-3">
        <button
          onClick={() => setStaleOnly((v) => !v)}
          aria-pressed={staleOnly}
          className={`px-4 py-2 min-h-11 rounded-full text-sm font-medium border transition-colors ${
            staleOnly
              ? "bg-taxi text-ink border-taxi"
              : "bg-card text-ink-soft border-line hover:text-ink"
          }`}
        >
          {staleOnly ? KANBAN_SHOW_ALL_LABEL : KANBAN_ONLY_STALE_LABEL}
          {staleTotal > 0 && ` (${staleTotal})`}
        </button>
        <p className="text-xs text-muted" role="status">
          {byId.size} no funil · {staleTotal} sem retorno há {FOLLOWUP_STALE_DAYS}+ dias
        </p>
      </div>

      {/* aria-live policial: anuncia todo mover (fecha B6) */}
      <div aria-live="polite" role="status" className="sr-only">
        {announce}
      </div>

      {/* Board gerenciável (lg+): colunas flex-1 preenchem 100vw.
          Abaixo de lg, scroll horizontal de fallback (documentado na spec). */}
      <div className="flex w-max min-w-full flex-1 items-stretch gap-3 lg:w-full">
        {columns.map((col) => {
          const { visible: ids, hidden } =
            renderedByStatus[col.status] ?? emptyColumn;
          const hanging = col.ids.filter((id) =>
            isHanging(followUps[id], FOLLOWUP_STALE_DAYS),
          ).length;
          return (
            <section
              key={col.status}
              aria-label={`${col.label}, ${ids.length} imóveis`}
              onDragOver={(e) => {
                // Drop zone da coluna inteira (leva kanban-drag-drop).
                if (!dragIdRef.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const slot = slotFromPoint(e.currentTarget, col.status, e.clientY);
                const cur = dropSlotRef.current;
                if (!cur || cur.status !== slot.status || cur.index !== slot.index) {
                  setSlot(slot);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                commitDrop();
              }}
              className="flex max-h-[70vh] min-h-0 w-72 shrink-0 flex-col overflow-y-auto rounded-xl border border-line bg-sand p-2 shadow-sm sm:w-80 lg:w-auto lg:min-w-0 lg:flex-1 lg:shrink"
            >
              <header className="mb-2 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink">{col.label}</h3>
                  <span
                    aria-label={`${ids.length} imóveis em ${col.label}`}
                    className="text-xs font-mono text-ink-soft bg-card border border-line rounded-full px-2 py-0.5"
                  >
                    {ids.length}
                  </span>
                </div>
                {hanging > 0 && (
                  <p className="mt-1 text-xs text-amberink font-medium">
                    {hanging} sem retorno há {FOLLOWUP_STALE_DAYS}+ dias
                  </p>
                )}
              </header>

              <div className="space-y-1.5">
                {ids.length === 0 && (
                  <p className="text-xs text-muted bg-card border border-dashed border-line rounded-lg p-2">
                    {KANBAN_EMPTY_COLUMN_HINT}
                  </p>
                )}
                {ids.map((id, i) => {
                  const a = byId.get(id);
                  if (!a) return null;
                  const fu = followUps[id];
                  const isExpanded = expandedCardId === id;
                  const showIndicator =
                    dragId !== null &&
                    dropSlot !== null &&
                    dropSlot.status === col.status &&
                    dropSlot.index === i;
                  return (
                    <Fragment key={id}>
                      {showIndicator && (
                        <div
                          data-testid="kanban-drop-indicator"
                          role="presentation"
                          className="mx-1 my-0.5 h-1 shrink-0 rounded-full bg-taxi"
                        />
                      )}
                    <article
                      tabIndex={0}
                      aria-label={`${a.title}, ${col.label}`}
                      draggable={!isExpanded}
                      data-kanban-card
                      onDragStart={(e) => {
                        // HTML5 DnD: data obrigatória pro Firefox pegar o drag.
                        e.dataTransfer.setData("text/plain", id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(id);
                      }}
                      onDragEnd={() => {
                        // Se soltou fora de qualquer coluna, limpa o estado.
                        if (dragIdRef.current === id) setDragId(null);
                        setSlot(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setMenuFor(null);
                          setExpandedCardId((current) =>
                            current === id ? null : id,
                          );
                          return;
                        }
                        const m = moveShortcut(e.key, col.status, visibleOrder);
                        if (m) {
                          e.preventDefault();
                          move(id, m.to, m.toIndex);
                        }
                        if (e.key === "Escape") setMenuFor(null);
                      }}
                      onClick={(e) => {
                        // Clique no article abre o inline. Clique que vem de
                        // dentro do menu é dos próprios itens, que já fazem
                        // setMenuFor(null) — expandir o card aqui seria
                        // efeito colateral.
                        if ((e.target as HTMLElement).closest('[role="menu"]')) return;
                        setMenuFor(null);
                        setExpandedCardId((current) =>
                          current === id ? null : id,
                        );
                      }}
                      className={`bg-card border border-line rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                        dragId === id ? "opacity-50" : ""
                      }`}
                    >
                      {isExpanded ? (
                        <KanbanCardDetail
                          apartment={a}
                          onClose={() => setExpandedCardId(null)}
                        />
                      ) : (
                        <>
                      {/* Pílula compacta: miniatura 40px + título/bairro/preço +
                          selo; mover/contato no menu. */}
                      <div className="flex items-center gap-2 p-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(null);
                            setExpandedCardId((current) =>
                              current === id ? null : id,
                            );
                          }}
                          aria-label={`Abrir detalhes de ${a.title}`}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                        >
                          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sand">
                            <Image
                              src={a.image}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-ink">
                              {a.title}
                            </span>
                            <span className="block truncate text-xs text-ink-soft">
                              {a.neighborhood} ·{" "}
                              <span className="font-mono">
                                {formatBRL(a.total)}
                              </span>
                            </span>
                            <FollowUpSeal fu={followUps[id]} />
                          </span>
                        </button>
                        <a
                          href={buildWhatsAppLink(
                            a.phone,
                            buildWhatsAppConfirm(a),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Abrir WhatsApp sobre ${a.title}`}
                          data-kanban-whatsapp
                          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand hover:text-ink"
                        >
                          <WhatsappLogo
                            size={18}
                            weight="fill"
                            className="text-st-green"
                          />
                        </a>
                        <button
                          aria-label={`Mover ${a.title}, abrir menu de destinos`}
                          aria-expanded={menuFor === id}
                          aria-haspopup="menu"
                          onClick={(e) => {
                            // stopPropagation: sem isso o clique sobe para o
                            // <article>, que faz setMenuFor(null) na mesma
                            // fra e o menu nunca abre.
                            e.stopPropagation();
                            setMenuFor((v) => (v === id ? null : id));
                          }}
                          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand hover:text-ink"
                        >
                          <DotsThree size={18} weight="bold" />
                        </button>
                      </div>

                      {/* Menu do card (AC-1: abrir + escolher = ≤2 ações):
                          retorno do corretor + destinos topo/fim */}
                      {menuFor === id && (
                        <div
                          role="menu"
                          aria-label={`Ações de ${a.title}`}
                          className="mx-1.5 mb-1.5 border border-line rounded-lg bg-paper p-1 space-y-0.5"
                        >
                          <button
                            role="menuitem"
                            onClick={() => {
                              markContact(id);
                              setMenuFor(null);
                            }}
                            className="flex min-h-9 w-full items-center px-2 text-xs font-medium text-ink-soft rounded-md hover:text-ink hover:bg-sand"
                          >
                            {KANBAN_CONTACT_LABEL}
                            {fu && fu.attempts > 0 ? ` ×${fu.attempts}` : ""}
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              markReturned(id);
                              setMenuFor(null);
                            }}
                            className="flex min-h-9 w-full items-center px-2 text-xs font-medium text-ink-soft rounded-md hover:text-ink hover:bg-sand"
                          >
                            {KANBAN_RETURNED_LABEL}
                          </button>
                          <div
                            role="separator"
                            className="border-t border-line"
                          />
                          {columns
                            .filter((c) => c.status !== col.status)
                            .map((c) => (
                              <div
                                key={c.status}
                                role="none"
                                className="flex items-center gap-1"
                              >
                                <span className="flex-1 text-xs text-ink-soft px-2 truncate">
                                  {c.label}
                                </span>
                                <button
                                  role="menuitem"
                                  onClick={() => move(id, c.status, 0)}
                                  className="min-h-9 px-2 text-xs text-ink-soft hover:text-ink hover:bg-sand rounded-md"
                                >
                                  topo
                                </button>
                                <button
                                  role="menuitem"
                                  onClick={() => move(id, c.status)}
                                  className="min-h-9 px-2 text-xs text-ink-soft hover:text-ink hover:bg-sand rounded-md"
                                >
                                  fim
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                        </>
                      )}
                    </article>
                    </Fragment>
                  );
                })}
                {/* Slot "fim da coluna": depois do último card visível. */}
                {dragId !== null &&
                  dropSlot !== null &&
                  dropSlot.status === col.status &&
                  dropSlot.index >= ids.length && (
                    <div
                      data-testid="kanban-drop-indicator"
                      role="presentation"
                      className="mx-1 my-0.5 h-1 shrink-0 rounded-full bg-taxi"
                    />
                  )}
              </div>
              {hidden.length > 0 && (
                <button
                  onClick={() => setOverflowFor(col.status)}
                  aria-label={`Mostrar ${hidden.length} imóveis ocultos em ${col.label}`}
                  className="mt-2 flex min-h-11 w-full shrink-0 items-center justify-center rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
                >
                  +{hidden.length} restantes
                </button>
              )}
            </section>
          );
        })}
      </div>

      {/* Lista "+N restantes": dialog com os ocultos da coluna
          (jump-list — clique abre o detalhe; Esc fecha sem fechar a view). */}
      {overflowFor && (
        <div
          data-kanban-overflow
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <button
            aria-label={`Fechar lista de ${overflowLabel}`}
            onClick={() => setOverflowFor(null)}
            className="absolute inset-0 bg-night/60"
          />
          <div
            ref={overflowPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${overflowLabel} — mais ${overflowIds.length} imóveis`}
            tabIndex={-1}
            className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl focus:outline-none"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-card px-4 py-3">
              <h3 className="truncate text-sm font-bold text-ink">
                {overflowLabel}{" "}
                <span className="font-mono font-normal text-ink-soft">
                  +{overflowIds.length}
                </span>
              </h3>
              <button
                onClick={() => setOverflowFor(null)}
                aria-label={`Fechar lista de ${overflowLabel} (Esc)`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand hover:text-ink"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
              {overflowIds.map((id) => {
                const a = byId.get(id);
                if (!a) return null;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setOverflowFor(null);
                      onSelect(a);
                    }}
                    aria-label={`Abrir detalhes de ${a.title}`}
                    className="flex w-full items-center gap-2 rounded-xl border border-line bg-card p-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sand">
                      <Image
                        src={a.image}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink">
                        {a.title}
                      </span>
                      <span className="block truncate text-xs text-ink-soft">
                        {a.neighborhood} ·{" "}
                        <span className="font-mono">
                          {formatBRL(a.total)}
                        </span>
                      </span>
                      <FollowUpSeal fu={followUps[id]} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
