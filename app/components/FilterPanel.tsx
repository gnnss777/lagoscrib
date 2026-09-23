"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, FunnelSimple } from "@phosphor-icons/react";
import type { Apartment } from "@/lib/data";
import {
  applyFilters,
  countActiveFilters,
  type FilterState,
  type FurnishedFilter,
  type PetsFilter,
  type StatusGetter,
} from "@/lib/filters";
import {
  AREA_BOUNDS,
  BATHROOM_OPTIONS,
  BEDROOM_OPTIONS,
  CONDO_MAX_BOUNDS,
  FACILITY_GROUPS,
  PARKING_OPTIONS,
  RENT_PRICE_BOUNDS,
  SALE_PRICE_BOUNDS,
} from "@/lib/constants";
import type { TransactionTab } from "@/lib/transaction";

interface FilterPanelProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onClear: () => void;
  pool: Apartment[];
  getStatus: StatusGetter;
  tab: TransactionTab;
}

const inputCls =
  "input-field w-full min-h-11 cursor-pointer text-sm";
const labelCls = "block text-xs font-medium text-ink-soft mb-1";
const chipBase =
  "inline-flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-lg border text-sm font-medium transition-colors";

function TriState({
  label,
  value,
  onChange,
  testid,
}: {
  label: string;
  value: "all" | "yes" | "no";
  onChange: (v: "all" | "yes" | "no") => void;
  testid: string;
}) {
  const opts = [
    { v: "all", label: "Tanto faz" },
    { v: "yes", label: "Sim" },
    { v: "no", label: "Não" },
  ] as const;
  return (
    <div>
      <span id={`${testid}-label`} className={labelCls}>
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${testid}-label`}
        data-testid={testid}
        className="flex gap-1 p-1 rounded-xl bg-paper border border-line w-fit"
      >
        {opts.map(({ v, label: l }) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`px-4 py-2 min-h-11 rounded-lg text-sm font-semibold transition-colors ${
              value === v
                ? "bg-taxi text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// Painel de filtros avançados (S009, UX spec APPROVED em docs/ux/).
// Presentacional: toda decisão mora em lib/filters.ts; aqui só chama e renderiza.
export default function FilterPanel({
  filters,
  onChange,
  onClear,
  pool,
  getStatus,
  tab,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const clearRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLSelectElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = countActiveFilters(filters);
  const priceBounds = tab === "comprar" ? SALE_PRICE_BOUNDS : RENT_PRICE_BOUNDS;
  const priceSectionLabel =
    tab === "comprar" ? "Preço de venda (R$)" : "Aluguel total /mês (R$)";

  // reduced-motion: sem animação de expansão quando ativo.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura client-only pós-mount (matchMedia não existe no SSR)
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // Esc fecha e devolve o foco ao gatilho (AC-FILT-06).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    // Foco entra no painel ao abrir (Limpar se visível, senão 1º select).
    (clearRef.current ?? firstRef.current)?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Contagem ao vivo: impacto da opção somada aos demais grupos ativos.
  const countWith = (over: Partial<FilterState>): number =>
    applyFilters(pool, { ...filters, ...over }, getStatus).length;

  const num = (
    id: string,
    label: string,
    value: number | null,
    set: (v: number | null) => void,
    placeholder: number
  ) => (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        value={value ?? ""}
        placeholder={String(placeholder)}
        onChange={(e) =>
          set(e.target.value === "" ? null : Number(e.target.value))
        }
        className="input-field w-full min-h-11 text-sm"
      />
    </div>
  );

  const minSelect = (
    id: string,
    label: string,
    value: number,
    set: (v: number) => void,
    options: readonly number[],
    group: "bedroomsMin" | "bathroomsMin" | "parkingMin"
  ) => (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <select
        id={id}
        ref={group === "bedroomsMin" ? firstRef : undefined}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className={inputCls}
      >
        <option value={0}>Tanto faz</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}+ ({countWith({ [group]: o } as Partial<FilterState>)})
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="mb-6">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="filter-panel"
        data-testid="filter-toggle"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-4 py-2.5 min-h-11 rounded-xl border border-inputbd bg-card text-sm font-semibold text-ink shadow-sm hover:border-ink transition-colors"
      >
        <FunnelSimple size={16} />
        Mais filtros{active > 0 ? ` (${active})` : ""}
      </button>

      {open && (
        <motion.div
          id="filter-panel"
          data-testid="filter-panel"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className="mt-3 bg-card border border-line rounded-2xl p-5 space-y-5 shadow-sm"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {minSelect(
              "f-quartos",
              "Quartos (mín)",
              filters.bedroomsMin,
              (v) => onChange({ ...filters, bedroomsMin: v }),
              BEDROOM_OPTIONS,
              "bedroomsMin"
            )}
            {minSelect(
              "f-banheiros",
              "Banheiros (mín)",
              filters.bathroomsMin,
              (v) => onChange({ ...filters, bathroomsMin: v }),
              BATHROOM_OPTIONS,
              "bathroomsMin"
            )}
            {minSelect(
              "f-vagas",
              "Vagas (mín)",
              filters.parkingMin,
              (v) => onChange({ ...filters, parkingMin: v }),
              PARKING_OPTIONS,
              "parkingMin"
            )}
          </div>

          <div>
            <span className={labelCls}>{priceSectionLabel}</span>
            <div className="grid grid-cols-2 gap-4">
              {num(
                "f-preco-min",
                "Mínimo",
                filters.priceMin,
                (v) => onChange({ ...filters, priceMin: v }),
                priceBounds.min
              )}
              {num(
                "f-preco-max",
                "Máximo",
                filters.priceMax,
                (v) => onChange({ ...filters, priceMax: v }),
                priceBounds.max
              )}
            </div>
          </div>

          <div>
            <span className={labelCls}>Área (m²)</span>
            <div className="grid grid-cols-2 gap-4">
              {num(
                "f-area-min",
                "Mínima",
                filters.areaMin,
                (v) => onChange({ ...filters, areaMin: v }),
                AREA_BOUNDS.min
              )}
              {num(
                "f-area-max",
                "Máxima",
                filters.areaMax,
                (v) => onChange({ ...filters, areaMax: v }),
                AREA_BOUNDS.max
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            {num(
              "f-cond-max",
              "Condomínio até (R$)",
              filters.condoMax,
              (v) => onChange({ ...filters, condoMax: v }),
              CONDO_MAX_BOUNDS.max
            )}
            <label className="flex items-center gap-2.5 min-h-11 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={filters.noCondo}
                onChange={(e) =>
                  onChange({ ...filters, noCondo: e.target.checked })
                }
                className="w-5 h-5 shrink-0 accent-taxi"
              />
              Sem condomínio
            </label>
          </div>

          <div className="flex flex-wrap gap-6">
            <TriState
              label="Mobiliado"
              value={filters.furnished}
              onChange={(v: FurnishedFilter) =>
                onChange({ ...filters, furnished: v })
              }
              testid="f-mobiliado"
            />
            <TriState
              label="Aceita pets"
              value={filters.pets}
              onChange={(v: PetsFilter) => onChange({ ...filters, pets: v })}
              testid="f-pets"
            />
          </div>

          <div className="space-y-4">
            {FACILITY_GROUPS.map(({ group, items }) => {
              const selected = items.filter((i) =>
                filters.facilities.includes(i)
              );
              return (
                <div key={group} role="group" aria-label={`Facilidades: ${group}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-ink-soft">
                      {group}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...filters,
                            facilities: [
                              ...filters.facilities,
                              ...items.filter(
                                (i) => !filters.facilities.includes(i)
                              ),
                            ],
                          })
                        }
                        className="text-xs text-amberink hover:text-ink font-medium min-h-11 px-2"
                      >
                        Marcar todas
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...filters,
                            facilities: filters.facilities.filter(
                              (f) => !items.some((i) => i === f)
                            ),
                          })
                        }
                        className="text-xs text-muted hover:text-ink font-medium min-h-11 px-2"
                      >
                        Limpar todas
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => {
                      const on = filters.facilities.includes(item);
                      const n = countWith({ facilities: [item] });
                      return (
                        <button
                          key={item}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            onChange({
                              ...filters,
                              facilities: on
                                ? filters.facilities.filter((f) => f !== item)
                                : [...filters.facilities, item],
                            })
                          }
                          className={`${chipBase} ${
                            on
                              ? "bg-taxi text-ink border-taxi font-semibold shadow-sm"
                              : "bg-paper text-ink border-inputbd hover:border-ink"
                          }`}
                        >
                          {on && <Check size={14} weight="bold" />}
                          {item} · {n}
                        </button>
                      );
                    })}
                    {selected.length > 0 && (
                      <span className="sr-only">
                        {selected.length} de {items.length} marcadas em {group}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {active > 0 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm text-ink-soft">
                {active} filtro{active > 1 ? "s" : ""} ativo
                {active > 1 ? "s" : ""}
              </p>
              <button
                ref={clearRef}
                type="button"
                onClick={onClear}
                className="px-4 py-2.5 min-h-11 rounded-lg text-sm font-semibold border border-inputbd bg-card text-ink hover:border-ink transition-colors"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
