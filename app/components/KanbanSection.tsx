"use client";

// Quadro de prospecção como MODO DE VISUALIZAÇÃO do app, não mais um modal
// em tela cheia (leva unificacao-busca-quadro). A busca e o quadro mostram o
// mesmo pool (lib/pool.ts) mudando só a visualização; quem escolhe é o
// seletor no header (Dashboard), e este componente é o corpo do modo "quadro".
//
// O painel de configuração (engrenagem) fica aqui dentro, no mesmo lugar do
// board — antes era um aside sibling do overlay. Mesma chave de persistência.
import { useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeSlash,
  GearSix,
  Kanban,
} from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import {
  KANBAN_COLS_STORAGE_KEY,
  KANBAN_COLS_STORAGE_VERSION,
  KANBAN_TAB_LABEL,
  QUADRO_HINT,
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

interface KanbanSectionProps {
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

export default function KanbanSection({
  apartments,
  onSelect,
}: KanbanSectionProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const [cfg, setCfg] = useState<ColumnConfig>(DEFAULT_COLUMN_CONFIG);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação pós-mount, padrão AppContext
      setCfg(loadConfig());
      setHydrated(true);
    }
  }, [hydrated]);

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

  const visiveis = KANBAN_COLUMNS.filter((s) => !cfg.hidden.includes(s)).length;

  return (
    <section
      aria-label={KANBAN_TAB_LABEL}
      data-testid="kanban-view"
      className="flex flex-col gap-3"
    >
      {/* Identificação do modo: título + o que é + contagem. O seletor do
          header já diz o modo; aqui repetimos para quem entra direto. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Kanban size={20} weight="bold" className="text-amberink" />
            {KANBAN_TAB_LABEL}
            <span className="text-sm font-normal text-ink-soft">
              · {apartments.length} imóveis
            </span>
          </h2>
          <p className="text-xs text-muted">{QUADRO_HINT}</p>
        </div>
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
      </div>

      <div className="flex min-h-0 gap-4">
        {/* Board com altura da viewport menos o header e a barra de modo:
            a coluna rola por dentro, a página não. Abaixo de lg, scroll de
            fallback (horizontal + vertical) — ver spec ESTÁTICO. */}
        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-auto rounded-2xl border border-line bg-card p-3 lg:overflow-hidden">
          <KanbanBoard apartments={apartments} colConfig={cfg} onSelect={onSelect} />
        </div>

        {configOpen && (
          <aside
            id="kanban-config-panel"
            aria-label="Configurar quadro"
            className="shrink-0 w-80 max-w-[85vw] max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-card p-4"
          >
            <p className="text-sm text-ink-soft mb-4">
              Renomeie, reordene ou oculte colunas. Vale para este dispositivo; o
              funil continua o mesmo.
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
                      ...KANBAN_COLUMNS.filter((s) => !prev.order.includes(s)),
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
                Voltar ao padrão ({KANBAN_COLUMNS.length} colunas)
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Contagem de colunas: texto informativo, sem aria-live — o
          aria-live="polite" do board (KanbanBoard) anuncia os movimentos e
          dois regions com o mesmo papel duplicariam a leitura. */}
      <p className="text-xs text-muted">
        {visiveis} de {KANBAN_COLUMNS.length} colunas visíveis
        {cfg.hidden.length > 0 && ` (${cfg.hidden.length} ocultas)`}.
      </p>
    </section>
  );
}
