"use client";

// Quadro de prospecção como MODO DE VISUALIZAÇÃO do app, não mais um modal
// em tela cheia (leva unificacao-busca-quadro). A busca e o quadro mostram o
// mesmo pool (lib/pool.ts) mudando só a visualização; quem escolhe é o
// seletor no header (Dashboard), e este componente é o corpo do modo "quadro".
//
// O painel de configuração (engrenagem) fica aqui dentro, no mesmo lugar do
// board — antes era um aside sibling do overlay. Mesma chave de persistência.
//
// Filtros DO QUADRO (leva kanban-filtros): são os mesmos dados da busca, mas
// o recorte é deste componente (`visiveis`, repassado ao board). A busca
// filtra em Dashboard/lib/filters — os dois painéis são independentes de
// propósito: quem está no quadro filtra por etapa do funil, quem está na
// busca filtra por vitrine. Nada aqui toca em lib/filters.ts.
//
// Este componente é REMONTADO a cada troca de aba (Dashboard usa key="quadro"),
// então o recorte de filtro precisa sobreviver em localStorage — igual a
// customização de colunas. Chave declarada aqui, e não em lib/constants.ts,
// que é de outro dono.
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeSlash,
  FunnelSimple,
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
import { formatBRL } from "@/lib/antiDores";
import {
  DEFAULT_COLUMN_CONFIG,
  KANBAN_COLUMNS,
  STATUS_LABELS,
  columnLabel,
  parseColumnConfig,
  type ColumnConfig,
  type StatusType,
} from "@/lib/kanban";
import { useApp } from "@/lib/AppContext";
import KanbanBoard, { kanbanColumns } from "./KanbanBoard";

// Chave própria do recorte do quadro (só visualização — nunca estado do imóvel).
export const KANBAN_FILTERS_STORAGE_KEY = "apartamentos-app-kanban-filters";
export const KANBAN_FILTERS_STORAGE_VERSION = 1;

/** Grupo dos imóveis sem `source` preenchido. */
export const SEM_ORIGEM = "sem origem";

/**
 * Faixas de all-in (aluguel + condomínio + IPTU). O teto do produto é o
 * `total`, nunca o `rent` cru — o dono decide por quanto sobra no mês.
 */
export interface TotalBand {
  id: string;
  label: string;
  min: number;
  max: number;
}

export const TOTAL_BANDS: TotalBand[] = [
  { id: "ate-2000", label: `até ${formatBRL(2000)}`, min: 0, max: 2000 },
  {
    id: "2000-3000",
    label: `${formatBRL(2000)} a ${formatBRL(3000)}`,
    min: 2000,
    max: 3000,
  },
  {
    id: "3000-4000",
    label: `${formatBRL(3000)} a ${formatBRL(4000)}`,
    min: 3000,
    max: 4000,
  },
  {
    id: "4000-6000",
    label: `${formatBRL(4000)} a ${formatBRL(6000)}`,
    min: 4000,
    max: 6000,
  },
  {
    id: "acima-6000",
    label: `acima de ${formatBRL(6000)}`,
    min: 6000,
    max: Number.POSITIVE_INFINITY,
  },
];

/** Degraus de mínimo offertos. Só entram na UI os que o pool atende. */
const BEDROOM_STEPS = [1, 2, 3, 4];
const AREA_STEPS = [30, 40, 50, 60, 70, 80, 100, 120, 150];

export interface KanbanFilters {
  version: number;
  /** Origem (portal). Vazio = todas. */
  sources: string[];
  neighborhoods: string[];
  /** Ids de TOTAL_BANDS. Vazio = todas. */
  totalBands: string[];
  /** Mínimos de quartos marcados; vale o menor. Vazio = sem mínimo. */
  bedrooms: number[];
  /** Mínimos de área marcados; vale o menor. Vazio = sem mínimo. */
  area: number[];
  /** Etapas do funil marcadas. Vazio = todas. */
  columns: StatusType[];
}

function emptyFilters(): KanbanFilters {
  return {
    version: KANBAN_FILTERS_STORAGE_VERSION,
    sources: [],
    neighborhoods: [],
    totalBands: [],
    bedrooms: [],
    area: [],
    columns: [],
  };
}

export const DEFAULT_KANBAN_FILTERS: KanbanFilters = emptyFilters();

/** Origem normalizada: o que não tem portal entra em "sem origem". */
export function sourceKey(a: Apartment): string {
  const source = (a.source ?? "").trim();
  return source || SEM_ORIGEM;
}

function neighborhoodKey(a: Apartment): string {
  return (a.neighborhood ?? "").trim();
}

/** Faixa de all-in do imóvel; `null` = valor ausente (nunca exclui). */
export function totalBandId(total: unknown): string | null {
  if (typeof total !== "number" || !Number.isFinite(total)) return null;
  const band = TOTAL_BANDS.find((b) => total >= b.min && total < b.max);
  return band ? band.id : null;
}

/**
 * Parse do recorte salvo (chave `apartamentos-app-kanban-filters`).
 * Lixo, versão velha ou valor fora do domínio → default exato, nunca quebra
 * o quadro. Mesma política de `parseColumnConfig`.
 */
export function parseKanbanFilters(raw: unknown): KanbanFilters {
  if (typeof raw !== "string") return emptyFilters();
  try {
    const p = JSON.parse(raw) as Partial<KanbanFilters>;
    if (p?.version !== KANBAN_FILTERS_STORAGE_VERSION) return emptyFilters();
    const texts = (v: unknown, allowed?: readonly string[]): string[] =>
      Array.isArray(v)
        ? [
            ...new Set(
              v.filter(
                (x): x is string =>
                  typeof x === "string" &&
                  x.trim().length > 0 &&
                  (!allowed || allowed.includes(x)),
              ),
            ),
          ]
        : [];
    const steps = (v: unknown): number[] =>
      Array.isArray(v)
        ? [
            ...new Set(
              v.filter(
                (x): x is number =>
                  typeof x === "number" &&
                  Number.isFinite(x) &&
                  x > 0,
              ),
            ),
          ].sort((a, b) => a - b)
        : [];
    return {
      version: KANBAN_FILTERS_STORAGE_VERSION,
      sources: texts(p.sources),
      neighborhoods: texts(p.neighborhoods),
      totalBands: texts(
        p.totalBands,
        TOTAL_BANDS.map((b) => b.id),
      ),
      bedrooms: steps(p.bedrooms),
      area: steps(p.area),
      columns: texts(p.columns, KANBAN_COLUMNS) as StatusType[],
    };
  } catch {
    return emptyFilters();
  }
}

/** Quantas seleções estão ativas (badge do botão "Filtros"). */
export function countActiveKanbanFilters(f: KanbanFilters): number {
  return (
    f.sources.length +
    f.neighborhoods.length +
    f.totalBands.length +
    f.bedrooms.length +
    f.area.length +
    f.columns.length
  );
}

export interface FilterOption<T> {
  value: T;
  label: string;
}

export interface KanbanFilterOptions {
  sources: FilterOption<string>[];
  neighborhoods: FilterOption<string>[];
  totalBands: FilterOption<string>[];
  bedrooms: FilterOption<number>[];
  area: FilterOption<number>[];
}

/**
 * Opções oferecidas, derivadas do POOL inteiro (não do recorte: se viessem
 * do recorte, marcar um filtro sumiria as outras opções e não daria para
 * desmarcar). Só o que existe aparece, e os degraus só entram se ao menos um
 * imóvel os atinge — evita 40 checkboxes de área morta.
 */
export function kanbanFilterOptions(
  list: Apartment[],
): KanbanFilterOptions {
  const sources = new Set<string>();
  const hoods = new Set<string>();
  const bands = new Set<string>();
  let maxBedrooms = 0;
  let maxArea = 0;
  for (const a of list) {
    sources.add(sourceKey(a));
    const hood = neighborhoodKey(a);
    if (hood) hoods.add(hood);
    const band = totalBandId(a.total);
    if (band) bands.add(band);
    if (typeof a.bedrooms === "number") {
      maxBedrooms = Math.max(maxBedrooms, a.bedrooms);
    }
    if (typeof a.area === "number") maxArea = Math.max(maxArea, a.area);
  }
  return {
    sources: [...sources]
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((value) => ({ value, label: value })),
    neighborhoods: [...hoods]
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((value) => ({ value, label: value })),
    totalBands: TOTAL_BANDS.filter((b) => bands.has(b.id)).map((b) => ({
      value: b.id,
      label: b.label,
    })),
    bedrooms: BEDROOM_STEPS.filter((n) => n <= maxBedrooms).map((n) => ({
      value: n,
      label: `${n}+`,
    })),
    area: AREA_STEPS.filter((n) => n <= maxArea).map((n) => ({
      value: n,
      label: `${n} m²+`,
    })),
  };
}

/**
 * Recorta o pool do quadro (AND entre grupos; OR dentro de cada grupo).
 *
 * Mesma regra dura de `lib/filters`: dado ausente nunca exclui — imóvel sem
 * `total`, sem `bedrooms` ou sem `area` passa nos mínimos, porque o schema é
 * aditivo e não se descarta o que não se sabe.
 */
export function applyKanbanFilters(
  list: Apartment[],
  f: KanbanFilters,
  statusOf: (apartmentId: string) => StatusType,
): Apartment[] {
  // Múltiplo marcar de mínimo = OR; o menor marcado é o que vale.
  const minBedrooms = f.bedrooms.length > 0 ? Math.min(...f.bedrooms) : 0;
  const minArea = f.area.length > 0 ? Math.min(...f.area) : 0;
  return list.filter((a) => {
    if (f.sources.length > 0 && !f.sources.includes(sourceKey(a))) return false;
    if (
      f.neighborhoods.length > 0 &&
      !f.neighborhoods.includes(neighborhoodKey(a))
    ) {
      return false;
    }
    if (f.totalBands.length > 0) {
      const band = totalBandId(a.total);
      if (band !== null && !f.totalBands.includes(band)) return false;
    }
    if (minBedrooms > 0 && typeof a.bedrooms === "number") {
      if (a.bedrooms < minBedrooms) return false;
    }
    if (minArea > 0 && typeof a.area === "number" && a.area < minArea) {
      return false;
    }
    if (f.columns.length > 0 && !f.columns.includes(statusOf(a.id))) {
      return false;
    }
    return true;
  });
}

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

function loadFilters(): KanbanFilters {
  try {
    const raw = localStorage.getItem(KANBAN_FILTERS_STORAGE_KEY);
    if (raw) return parseKanbanFilters(raw);
  } catch {
    // ignore
  }
  return emptyFilters();
}

/**
 * Grupo de checkboxes do painel. `<fieldset>/<legend>` nomeia o grupo e o
 * `<label>` involve o input — é o padrão nativo do app, sem ARIA paralelo:
 * cada caixa é alcançável por Tab e alternada por Espaço.
 */
function CheckGroup<T extends string | number>({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: FilterOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <label
              key={String(option.value)}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 transition-colors focus-within:ring-2 focus-within:ring-ink ${
                on
                  ? "border-taxi bg-taxi text-ink"
                  : "border-line bg-card text-ink-soft hover:text-ink"
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(option.value)}
                className="h-4 w-4 shrink-0 accent-ink"
              />
              <span className="text-xs font-medium">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export default function KanbanSection({
  apartments,
  onSelect,
}: KanbanSectionProps) {
  const { statuses, followUps } = useApp();
  const [configOpen, setConfigOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cfg, setCfg] = useState<ColumnConfig>(DEFAULT_COLUMN_CONFIG);
  const [filters, setFilters] =
    useState<KanbanFilters>(DEFAULT_KANBAN_FILTERS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação pós-mount, padrão AppContext
    setCfg(loadConfig());
    setFilters(loadFilters());
    setHydrated(true);
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

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KANBAN_FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore
    }
  }, [filters, hydrated]);

  // Etapa do funil de cada imóvel: independe de qualquer filtro (o recorte
  // não muda a etapa), então serve aos dois usos abaixo.
  const statusById = useMemo(() => {
    const map = new Map<string, StatusType>();
    const all = kanbanColumns(apartments, statuses, followUps, cfg);
    for (const column of all) {
      for (const id of column.ids) map.set(id, column.status);
    }
    return map;
  }, [apartments, statuses, followUps, cfg]);
  const statusOf = useMemo(
    () => (id: string) => statusById.get(id) ?? "novo",
    [statusById],
  );

  // Base SEM o filtro de etapa: as contagens por coluna precisam mostrar o
  // funil inteiro, senão marcar uma etapa zera as outras da lista.
  const baseVisible = useMemo(
    () =>
      applyKanbanFilters(apartments, { ...filters, columns: [] }, statusOf),
    [apartments, filters, statusOf],
  );
  const stageOptions: FilterOption<StatusType>[] = useMemo(
    () =>
      kanbanColumns(baseVisible, statuses, followUps, cfg).map((column) => ({
        value: column.status,
        label: `${column.label} (${column.ids.length})`,
      })),
    [baseVisible, statuses, followUps, cfg],
  );

  const visiveis = useMemo(
    () => applyKanbanFilters(apartments, filters, statusOf),
    [apartments, filters, statusOf],
  );
  const options = useMemo(() => kanbanFilterOptions(apartments), [apartments]);
  const activeFilters = countActiveKanbanFilters(filters);

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

  const colunasVisiveis = KANBAN_COLUMNS.filter(
    (s) => !cfg.hidden.includes(s),
  ).length;

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

      {/* Barra de filtros do quadro: recorte próprio, independente dos
          filtros da busca. O texto é informativo (sem aria-live) — quem
          anuncia movimento é o board. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="kanban-filter-panel"
          className={`inline-flex items-center gap-2 px-4 py-2 min-h-11 rounded-full text-sm font-semibold border transition-colors ${
            filtersOpen || activeFilters > 0
              ? "bg-taxi text-ink border-taxi"
              : "bg-card text-ink-soft border-line hover:text-ink hover:border-ink"
          }`}
        >
          <FunnelSimple size={16} weight="bold" />
          Filtros
          {activeFilters > 0 && ` (${activeFilters})`}
        </button>
        {activeFilters > 0 && (
          <button
            onClick={() => setFilters(emptyFilters())}
            className="px-4 py-2 min-h-11 rounded-full text-sm font-semibold bg-paper border border-line text-ink-soft hover:text-ink hover:border-ink transition-colors"
          >
            Limpar tudo
          </button>
        )}
        <p className="text-xs text-muted" data-testid="kanban-visible-count">
          {visiveis.length} de {apartments.length} imóveis visíveis
        </p>
      </div>

      {filtersOpen && (
        <section
          id="kanban-filter-panel"
          aria-label="Filtros do quadro"
          data-testid="kanban-filter-panel"
          className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4"
        >
          <p className="text-xs text-muted">
            Nada marcado = todos. Os filtros valem só para este quadro e ficam
            salvos neste dispositivo.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <CheckGroup
              legend="Etapa do funil"
              options={stageOptions}
              selected={filters.columns}
              onToggle={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  columns: toggleValue(prev.columns, value),
                }))
              }
            />
            <CheckGroup
              legend="Origem"
              options={options.sources}
              selected={filters.sources}
              onToggle={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  sources: toggleValue(prev.sources, value),
                }))
              }
            />
            <CheckGroup
              legend="Bairro"
              options={options.neighborhoods}
              selected={filters.neighborhoods}
              onToggle={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  neighborhoods: toggleValue(prev.neighborhoods, value),
                }))
              }
            />
            <CheckGroup
              legend="All-in por mês"
              options={options.totalBands}
              selected={filters.totalBands}
              onToggle={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  totalBands: toggleValue(prev.totalBands, value),
                }))
              }
            />
            <CheckGroup
              legend="Quartos (mínimo)"
              options={options.bedrooms}
              selected={filters.bedrooms}
              onToggle={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  bedrooms: toggleValue(prev.bedrooms, value),
                }))
              }
            />
            <CheckGroup
              legend="Área (mínima)"
              options={options.area}
              selected={filters.area}
              onToggle={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  area: toggleValue(prev.area, value),
                }))
              }
            />
          </div>
        </section>
      )}

      <div className="flex min-h-0 gap-4">
        {/* Board com altura da viewport menos o header e a barra de modo:
            a coluna rola por dentro, a página não. Abaixo de lg, scroll de
            fallback (horizontal + vertical) — ver spec ESTÁTICO. */}
        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-auto rounded-2xl border border-line bg-card p-3 lg:overflow-hidden">
          <KanbanBoard
            apartments={visiveis}
            colConfig={cfg}
            onSelect={onSelect}
          />
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
        {colunasVisiveis} de {KANBAN_COLUMNS.length} colunas visíveis
        {cfg.hidden.length > 0 && ` (${cfg.hidden.length} ocultas)`}.
      </p>
    </section>
  );
}
