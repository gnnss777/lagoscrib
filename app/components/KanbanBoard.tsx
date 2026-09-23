"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CaretLeft,
  CaretRight,
  Check,
  DotsThree,
  Phone,
} from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import { formatBRL } from "@/lib/antiDores";
import {
  FOLLOWUP_STALE_DAYS,
  KANBAN_CONTACT_LABEL,
  KANBAN_EMPTY_COLUMN_HINT,
  KANBAN_ONLY_STALE_LABEL,
  KANBAN_RETURNED_LABEL,
  KANBAN_SHOW_ALL_LABEL,
} from "@/lib/constants";
import {
  buildColumns,
  columnLabel,
  countHanging,
  isHanging,
  type ColumnConfig,
  type StatusType,
} from "@/lib/kanban";
import { useApp } from "@/lib/AppContext";

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
  const [announce, setAnnounce] = useState("");

  const byId = useMemo(() => new Map(apartments.map((a) => [a.id, a])), [apartments]);

  // Entradas sintetizadas: todo imóvel do pool tem posição (default = novo/fim).
  const columns = useMemo(() => {
    const entries = apartments.map((a) => {
      const found = statuses.find((s) => s.apartmentId === a.id);
      return found
        ? { ...found }
        : {
            apartmentId: a.id,
            status: "novo" as const,
            updatedAt: "",
            index: Number.MAX_SAFE_INTEGER,
          };
    });
    return buildColumns(entries, followUps, colConfig);
  }, [apartments, statuses, followUps, colConfig]);

  const visibleOrder = useMemo(
    () => columns.map((c) => c.status),
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

  const staleTotal = useMemo(
    () => countHanging(followUps, FOLLOWUP_STALE_DAYS),
    [followUps],
  );

  return (
    <div>
      {/* Barra do board: filtro + resumo */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={() => setStaleOnly((v) => !v)}
          aria-pressed={staleOnly}
          className={`px-3 py-2 min-h-11 rounded-lg text-sm font-medium border transition-colors ${
            staleOnly
              ? "bg-taxi text-ink border-taxi"
              : "bg-card text-ink-soft border-line hover:text-ink"
          }`}
        >
          {staleOnly ? KANBAN_SHOW_ALL_LABEL : KANBAN_ONLY_STALE_LABEL}
          {staleTotal > 0 && ` (${staleTotal})`}
        </button>
        <p className="text-xs text-muted" role="status">
          {apartments.length} no funil · {staleTotal} sem retorno há {FOLLOWUP_STALE_DAYS}+ dias
        </p>
      </div>

      {/* aria-live policial: anuncia todo mover (fecha B6) */}
      <div aria-live="polite" role="status" className="sr-only">
        {announce}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {columns.map((col) => {
          const ids = staleOnly
            ? col.ids.filter((id) =>
                isHanging(followUps[id], FOLLOWUP_STALE_DAYS),
              )
            : col.ids;
          const hanging = col.ids.filter((id) =>
            isHanging(followUps[id], FOLLOWUP_STALE_DAYS),
          ).length;
          return (
            <section
              key={col.status}
              aria-label={`${col.label}, ${ids.length} imóveis`}
              className="shrink-0 w-72 bg-paper border border-line rounded-xl p-3"
            >
              <header className="mb-3">
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

              <div className="space-y-3">
                {ids.length === 0 && (
                  <p className="text-xs text-muted bg-card border border-dashed border-line rounded-lg p-3">
                    {KANBAN_EMPTY_COLUMN_HINT}
                  </p>
                )}
                {ids.map((id) => {
                  const a = byId.get(id);
                  if (!a) return null;
                  const fu = followUps[id];
                  const hangingCard =
                    !!fu && fu.status === "aguardando" && fu.attempts > 0;
                  const idx = visibleOrder.indexOf(col.status);
                  return (
                    <article
                      key={id}
                      tabIndex={0}
                      aria-label={`${a.title}, ${col.label}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && menuFor !== id) {
                          e.preventDefault();
                          setMenuFor(id);
                          return;
                        }
                        const m = moveShortcut(e.key, col.status, visibleOrder);
                        if (m) {
                          e.preventDefault();
                          move(id, m.to, m.toIndex);
                        }
                        if (e.key === "Escape") setMenuFor(null);
                      }}
                      className="bg-card border border-line rounded-xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      <button
                        onClick={() => onSelect(a)}
                        className="block w-full text-left"
                      >
                        <div className="relative h-28">
                          <Image
                            src={a.image}
                            alt={a.title}
                            fill
                            sizes="288px"
                            className="object-cover"
                          />
                          {/* Selo de retorno na dobra superior (AC-3) */}
                          {hangingCard && (
                            <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-pastel text-ink text-[11px] font-bold px-2 py-1 rounded-md">
                              <Phone size={12} weight="bold" />
                              sem retorno ×{fu!.attempts}
                            </span>
                          )}
                          {fu?.status === "retornou" && (
                            <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-st-green-bg text-st-green text-[11px] font-bold px-2 py-1 rounded-md">
                              <Check size={12} weight="bold" />
                              retornou
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold text-ink line-clamp-1">
                            {a.title}
                          </p>
                          <p className="text-xs text-ink-soft mt-0.5">
                            {a.neighborhood} · {formatBRL(a.total)}
                          </p>
                          {fu?.lastContactAt && (
                            <p className="text-[11px] text-muted mt-1">
                              último contato{" "}
                              {new Intl.DateTimeFormat("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                              }).format(new Date(fu.lastContactAt))}
                            </p>
                          )}
                        </div>
                      </button>

                      {/* Mover em ≤2 ações (AC-1): ←/→ + menu */}
                      <div className="flex items-center gap-1 px-3 pb-1">
                        <button
                          aria-label={`Mover ${a.title} para coluna anterior`}
                          disabled={idx <= 0}
                          onClick={() => move(id, visibleOrder[idx - 1])}
                          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-ink-soft hover:text-ink hover:bg-sand disabled:opacity-30 transition-colors"
                        >
                          <CaretLeft size={18} weight="bold" />
                        </button>
                        <button
                          aria-label={`Mover ${a.title}, abrir menu de destinos`}
                          aria-expanded={menuFor === id}
                          aria-haspopup="menu"
                          onClick={() =>
                            setMenuFor((v) => (v === id ? null : id))
                          }
                          className="min-h-11 flex-1 flex items-center justify-center gap-1 rounded-lg text-xs font-medium text-ink-soft hover:text-ink hover:bg-sand transition-colors"
                        >
                          <DotsThree size={18} weight="bold" />
                          Mover…
                        </button>
                        <button
                          aria-label={`Mover ${a.title} para próxima coluna`}
                          disabled={idx < 0 || idx >= visibleOrder.length - 1}
                          onClick={() => move(id, visibleOrder[idx + 1])}
                          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-ink-soft hover:text-ink hover:bg-sand disabled:opacity-30 transition-colors"
                        >
                          <CaretRight size={18} weight="bold" />
                        </button>
                      </div>

                      {/* Retorno do corretor (fecha B3) */}
                      <div className="flex items-center gap-2 px-3 pb-3">
                        <button
                          onClick={() => markContact(id)}
                          className="min-h-9 flex-1 text-xs font-medium px-2 rounded-lg border border-line text-ink-soft hover:text-ink hover:border-ink transition-colors"
                        >
                          {KANBAN_CONTACT_LABEL}
                          {fu && fu.attempts > 0 ? ` ×${fu.attempts}` : ""}
                        </button>
                        <button
                          onClick={() => markReturned(id)}
                          className="min-h-9 flex-1 text-xs font-medium px-2 rounded-lg border border-line text-ink-soft hover:text-ink hover:border-ink transition-colors"
                        >
                          {KANBAN_RETURNED_LABEL}
                        </button>
                      </div>

                      {/* Menu de destinos (WAI-ARIA menu, topo/fim) */}
                      {menuFor === id && (
                        <div
                          role="menu"
                          aria-label={`Mover ${a.title} para`}
                          className="mx-3 mb-3 border border-line rounded-lg bg-paper p-1 space-y-0.5"
                        >
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
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
