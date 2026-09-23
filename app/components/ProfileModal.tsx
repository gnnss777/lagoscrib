"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeSlash,
  X,
} from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import {
  KANBAN_COLS_STORAGE_KEY,
  KANBAN_COLS_STORAGE_VERSION,
} from "@/lib/constants";
import {
  DEFAULT_COLUMN_CONFIG,
  KANBAN_COLUMNS,
  STATUS_LABELS,
  columnLabel,
  parseColumnConfig,
  type ColumnConfig,
} from "@/lib/kanban";
import { KANBAN_TAB_LABEL } from "@/lib/constants";
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

export default function ProfileModal({
  open,
  onClose,
  username,
  apartments,
  onSelect,
}: ProfileModalProps) {
  const [tab, setTab] = useState<"prospeccao" | "quadro">("prospeccao");
  const [cfg, setCfg] = useState<ColumnConfig>(DEFAULT_COLUMN_CONFIG);
  const [hydrated, setHydrated] = useState(false);

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
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="detail-overlay fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto"
          onClick={onClose}
        >
          <div className="fixed inset-0" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={`Perfil de ${username ?? "usuário"}`}
            className="relative w-full max-w-6xl bg-card border border-line rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <div>
                <h2 className="text-lg font-bold text-ink">
                  Olá, <span className="text-amberink">{username}</span>
                </h2>
                <div className="flex gap-2 mt-2" role="tablist" aria-label="Abas do perfil">
                  <button
                    role="tab"
                    aria-selected={tab === "prospeccao"}
                    onClick={() => setTab("prospeccao")}
                    className={`px-3 py-2 min-h-11 rounded-lg text-sm font-medium transition-colors ${
                      tab === "prospeccao"
                        ? "bg-taxi text-ink"
                        : "text-ink-soft hover:text-ink hover:bg-sand"
                    }`}
                  >
                    {KANBAN_TAB_LABEL}
                  </button>
                  <button
                    role="tab"
                    aria-selected={tab === "quadro"}
                    onClick={() => setTab("quadro")}
                    className={`px-3 py-2 min-h-11 rounded-lg text-sm font-medium transition-colors ${
                      tab === "quadro"
                        ? "bg-taxi text-ink"
                        : "text-ink-soft hover:text-ink hover:bg-sand"
                    }`}
                  >
                    Configurar quadro
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Fechar perfil (Esc)"
                className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-ink-soft hover:text-ink hover:bg-sand transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {tab === "prospeccao" && (
                <div role="tabpanel" aria-label={KANBAN_TAB_LABEL}>
                  <KanbanBoard
                    apartments={apartments}
                    colConfig={cfg}
                    onSelect={onSelect}
                  />
                </div>
              )}

              {tab === "quadro" && (
                <div role="tabpanel" aria-label="Configurar quadro">
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
                  {/* Colunas fora da ordem (caso a config venha de versão antiga) */}
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
                      className="px-4 py-2.5 min-h-11 rounded-lg text-sm font-semibold bg-paper border border-line text-ink-soft hover:text-ink hover:border-ink transition-colors"
                    >
                      Voltar ao padrão (6 colunas)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
