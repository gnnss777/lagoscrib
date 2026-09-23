"use client";

import { useEffect, useRef } from "react";
import { useScrollLock } from "@/lib/useScrollLock";
import Image from "next/image";
import { X, LinkSimple } from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import { pricePerM2 } from "@/lib/pricing";
import { formatBRL } from "@/lib/antiDores";
import {
  buildCompareFlags,
  effectiveTotal,
  sortCompareByTotalEffective,
} from "@/lib/compare";

interface CompareModalProps {
  apartments: Apartment[];
  onClose: () => void;
}

// Tabela lado a lado (S005/UX spec F4): ordem default por custo total efetivo,
// ausente = "—", links originais clicáveis, scroll horizontal em 360px.
export default function CompareModal({ apartments, onClose }: CompareModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const ordered = sortCompareByTotalEffective(apartments);
  useScrollLock();

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cell = (value: string) => (
    <span className="text-ink text-sm">{value}</span>
  );

  const moneyCell = (a: Apartment, value: number, suffix?: string) => (
    <span className="font-mono text-sm">
      <span className="text-amberink font-bold">{formatBRL(value)}</span>
      {suffix && <span className="text-muted text-xs"> {suffix}</span>}
    </span>
  );

  const rows: { label: string; render: (a: Apartment) => React.ReactNode }[] = [
    {
      label: "Foto",
      render: (a) => (
        <span className="relative block w-20 h-14 rounded-xl overflow-hidden">
          <Image
            src={a.image}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
            loading="lazy"
          />
        </span>
      ),
    },
    { label: "Bairro", render: (a) => cell(a.neighborhood) },
    { label: "Área", render: (a) => cell(`${a.area}m²`) },
    { label: "Quartos", render: (a) => cell(String(a.bedrooms)) },
    { label: "Banheiros", render: (a) => cell(String(a.bathrooms)) },
    { label: "Vagas", render: (a) => cell(String(a.parking)) },
    {
      label: "Aluguel / Preço",
      render: (a) =>
        a.transaction === "venda"
          ? moneyCell(a, a.salePrice ?? a.total)
          : moneyCell(a, a.rent, "/mês"),
    },
    {
      label: "Condomínio",
      render: (a) =>
        cell(a.condoUnknown ? "A confirmar" : formatBRL(a.condo)),
    },
    {
      label: "IPTU",
      render: (a) => cell(a.iptu > 0 ? formatBRL(a.iptu) : "Isento"),
    },
    {
      label: "Total / Preço total",
      render: (a) =>
        a.transaction === "venda"
          ? moneyCell(a, effectiveTotal(a))
          : moneyCell(a, effectiveTotal(a), "/mês"),
    },
    {
      label: "Preço/m²",
      render: (a) =>
        moneyCell(a, pricePerM2(effectiveTotal(a), a.area), "/m²"),
    },
    {
      label: "Atenção",
      render: (a) => {
        const flags = buildCompareFlags(a);
        return cell(flags.length > 0 ? flags.join(" · ") : "—");
      },
    },
    { label: "Pets", render: (a) => cell(a.pets ?? "—") },
    { label: "Origem", render: (a) => cell(a.source ?? "—") },
    {
      label: "Anúncio",
      render: (a) => (
        <a
          href={a.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-amberink hover:text-ink text-sm font-medium"
        >
          <LinkSimple size={14} />
          Ver anúncio
        </a>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto bg-night/60"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Comparando ${ordered.length} imóveis`}
        data-testid="compare-table"
        className="relative w-full max-w-5xl bg-card border border-line rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">
            Comparando {ordered.length} imóveis
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fechar comparação (Esc)"
            className="min-w-11 min-h-11 flex items-center justify-center rounded-full border border-inputbd text-ink hover:border-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th className="w-28" />
                {ordered.map((a) => (
                  <th
                    key={a.id}
                    data-testid="compare-col"
                    scope="col"
                    className="text-left align-top pb-3 pr-4 min-w-48"
                  >
                    <span className="block text-ink font-semibold text-sm line-clamp-2">
                      {a.title}
                    </span>
                    {/* S012: metragem em cada escolha — título + m² + preço */}
                    <span className="block text-muted text-xs mt-0.5">
                      {a.area}m²
                    </span>
                    <span className="block font-mono text-amberink font-bold text-sm mt-1">
                      {formatBRL(effectiveTotal(a))}
                      {a.transaction !== "venda" && (
                        <span className="text-muted text-xs font-normal"> /mês</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-line">
                  <th
                    scope="row"
                    className="text-left text-ink-soft text-xs font-medium uppercase tracking-wider py-3 pr-4 align-top"
                  >
                    {row.label}
                  </th>
                  {ordered.map((a) => (
                    <td key={a.id} className="py-3 pr-4 align-top">
                      {row.render(a)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
