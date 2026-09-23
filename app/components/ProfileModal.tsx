"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/lib/useScrollLock";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  Eye,
  EyeSlash,
  GearSix,
  X,
} from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import {
  KANBAN_COLS_STORAGE_KEY,
  KANBAN_COLS_STORAGE_VERSION,
  KANBAN_TAB_LABEL,
} from "@/lib/constants";
import {
  DEFAULT_COLUMN_CONFIG,
  KANBAN_COLUMNS,
  STATUS_LABELS,
  columnLabel,
  parseColumnConfig,
  type ColumnConfig,
} from "@/lib/kanban";
import KanbanBoard from "./KanbanBoard";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  username: string | null;
  apartments: Apartment[];
  onSelect: (apartment: Apartment) => void;
}

function loadConfig(): ColumnConfig {
  try {
    const raw = localStorage.getItem(KANBAN_COLS_STORAGE_KEY);
    if (raw) return parseColumnConfig(raw);
  } catch {
    // ignore
  }
  return { ...DEFAULT_COLUMN_CONFIG };
}

// Kanban em tela cheia (leva kanban-tela-inteira-ui, AC-U2/U3): view
// full-viewport com header próprio; "Configurar quadro" vira painel lateral
// (engrenagem) em vez de aba de diálogo. Mesma chave de persistência.
export default function ProfileModal({
  open,
  onClose,
  username,
  apartments,
  onSelect,
}: ProfileModalProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const [cfg, setCfg] = useState<ColumnConfig>(DEFAULT_COLUMN_CONFIG);
  const [hydrated, setHydrated] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  useScrollLock(open);

  // F1.4 view em tela cheia (não é dialog): foco na view ao abrir +
  // restaura o gatilho ao fechar.
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    viewRef.current?.focus();
    return () => {
      trigger?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && !hydrated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação pós-mount, padrão AppContext
      setCfg(loadConfig());
      setHydrated(true);
    }
  }, [open, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        KANBAN_COLS_STORAGE_KEY,
        JSON.stringify({ ...cfg, version: KANBAN_COLS_STORAGE_VERSION }),
      );
    } catch {
      // ignore
    }
  }, [cfg, hydrated]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Dialog "+N restantes" trata o próprio Esc (não fecha a view).
        if (
          (document.activeElement as HTMLElement | null)?.closest?.(
            "[data-kanban-overflow]",
          )
        )
          return;
        if (configOpen) setConfigOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, configOpen]);

  const moveOrder = (status: (typeof KANBAN_COLUMNS)[number], dir: -1 | 1) => {
    setCfg((prev) => {
      const order = prev.order.includes(status)
        ? [...prev.order]
        : [...prev.order, status];
      const i = order.indexOf(status);
      const j = i + dir;
      if (j < 0 || j >= order.length) return prev;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...prev, order };
    });
  };

  const toggleHidden = (status: (typeof KANBAN_COLUMNS)[number]) => {
    setCfg((prev) => ({
      ...prev,
      hidden: prev.hidden.includes(status)
        ? prev.hidden.filter((s) => s !== status)
        : [...prev.hidden, status],
    }));
  };

  const rename = (status: (typeof KANBAN_COLUMNS)[number], label: string) => {
    setCfg((prev) => {
      const labels = { ...prev.labels };
      if (!label.trim() || label.trim() === STATUS_LABELS[status]) {
        delete labels[status];
      } else {
        labels[status] = label.trim().slice(0, 40);
      }
      return { ...prev, labels };
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={viewRef}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-label={`${KANBAN_TAB_LABEL} de ${username ?? "usuário"}`}
          data-testid="kanban-view"
          className="fixed inset-0 z-50 bg-paper flex flex-col"
        >
          {/* Header próprio da view */}
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-line bg-card shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={onClose}
                aria-label="Voltar para a busca (Esc)"
                className="min-w-11 min-h-11 flex items-center justify-center rounded-full text-ink-soft hover:text-ink hover:bg-sand transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-lg font-bold text-ink truncate">
                {KANBAN_TAB_LABEL}
                <span className="hidden sm:inline text-sm font-normal text-ink-soft">
                  {" "}
                  · {username}
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfigOpen((v) => !v)}
                aria-expanded={configOpen}
                aria-controls="kanban-config-panel"
                className={`inline-flex items-center gap-2 px-4 py-2 min-h-11 rounded-full text-sm font-semibold border transition-colors ${
                  configOpen
                    ? "bg-taxi text-ink border-taxi"
                    : "bg-card text-ink-soft border-line hover:text-ink hover:border-ink"
                }`}
              >
                <GearSix size={16} />
                Configurar quadro
              </button>
              <button
                onClick={onClose}
                aria-label="Fechar prospecção (Esc)"
                className="min-w-11 min-h-11 flex items-center justify-center rounded-full text-ink-soft hover:text-ink hover:bg-sand transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Board estático sem scroll (lg+); abaixo de lg, scroll de
                fallback (horizontal + vertical) — ver spec ESTÁTICO. */}
            <div className="flex-1 min-w-0 overflow-x-auto overflow-y-auto px-4 sm:px-6 py-4 lg:overflow-hidden">
              <KanbanBoard
                apartments={apartments}
                colConfig={cfg}
                onSelect={onSelect}
              />
            </div>

            {/* Painel lateral de configuração */}
            {configOpen && (
              <aside
                id="kanban-config-panel"
                aria-label="Configurar quadro"
                className="shrink-0 w-80 max-w-[85vw] border-l border-line bg-card overflow-y-auto p-4"
              >
                <p className="text-sm text-ink-soft mb-4">
                  Renomeie, reordene ou oculte colunas. Vale para este
                  dispositivo; o funil continua o mesmo.
                </p>
                <ul className="space-y-2">
                  {cfg.order.map((s) => {
                    const hidden = cfg.hidden.includes(s);
                    return (
                      <li
                        key={s}
                        className="flex items-center gap-2 bg-paper border border-line rounded-xl p-2"
                      >
                        <div className="flex flex-col">
                          <button
                            aria-label={`Subir coluna ${columnLabel(s, cfg)}`}
                            onClick={() => moveOrder(s, -1)}
                            className="min-w-9 min-h-9 flex items-center justify-center rounded-md text-ink-soft hover:text-ink hover:bg-sand"
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            aria-label={`Descer coluna ${columnLabel(s, cfg)}`}
                            onClick={() => moveOrder(s, 1)}
                            className="min-w-9 min-h-9 flex items-center justify-center rounded-md text-ink-soft hover:text-ink hover:bg-sand"
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>
                        <input
                          key={`${s}-${columnLabel(s, cfg)}`}
                          aria-label={`Nome da coluna ${STATUS_LABELS[s]}`}
                          defaultValue={columnLabel(s, cfg)}
                          placeholder={STATUS_LABELS[s]}
                          onBlur={(e) => rename(s, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              rename(s, (e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="input-field flex-1 py-2 text-sm"
                        />
                        <button
                          aria-label={hidden ? `Mostrar coluna ${columnLabel(s, cfg)}` : `Ocultar coluna ${columnLabel(s, cfg)}`}
                          aria-pressed={hidden}
                          onClick={() => toggleHidden(s)}
                          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-ink-soft hover:text-ink hover:bg-sand transition-colors"
                        >
                          {hidden ? <EyeSlash size={18} /> : <Eye size={18} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {KANBAN_COLUMNS.filter((s) => !cfg.order.includes(s)).length > 0 && (
                  <button
                    onClick={() =>
                      setCfg((prev) => ({
                        ...prev,
                        order: [
                          ...prev.order,
                          ...KANBAN_COLUMNS.filter(
                            (s) => !prev.order.includes(s),
                          ),
                        ],
                      }))
                    }
                    className="mt-3 text-sm text-amberink hover:text-ink font-medium"
                  >
                    Restaurar colunas ausentes
                  </button>
                )}
                <div className="mt-4">
                  <button
                    onClick={() => setCfg({ ...DEFAULT_COLUMN_CONFIG })}
                    className="px-4 py-2.5 min-h-11 rounded-full text-sm font-semibold bg-paper border border-line text-ink-soft hover:text-ink hover:border-ink transition-colors"
                  >
                    Voltar ao padrão (6 colunas)
                  </button>
                </div>
              </aside>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
