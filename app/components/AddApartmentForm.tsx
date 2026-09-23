"use client";

import { useState } from "react";
import { Check, Plus, X } from "@phosphor-icons/react";
import { useApp } from "@/lib/AppContext";
import { FACILITY_GROUPS } from "@/lib/constants";

// Facilidades selecionáveis (achatado dos grupos de constantes — mesma fonte
// dos filtros, sem duplicar lista).
const FACILITY_OPTIONS: string[] = FACILITY_GROUPS.flatMap((g) => [...g.items]);

// Mapeia o select de pets p/ o schema (pets?: string — S001 aditivo).
// "Aceita animais"/"Não aceita animais" casam com o filtro de pets (S008).
const PETS_OPTIONS = [
  { value: "nao-informado", label: "Pets: não informado", pets: undefined },
  { value: "sim", label: "Pets: aceita", pets: "Aceita animais" },
  { value: "nao", label: "Pets: não aceita", pets: "Não aceita animais" },
] as const;

export default function AddApartmentForm() {
  const { addApartment } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    neighborhood: "",
    address: "",
    link: "",
    area: 70,
    bedrooms: 2,
    bathrooms: 1,
    parking: 1,
    petsOption: "nao-informado" as (typeof PETS_OPTIONS)[number]["value"],
    customFacility: "",
    transaction: "aluguel" as "aluguel" | "venda",
    rent: 2500,
    condo: 500,
    iptu: 150,
    salePrice: 400000,
    phone: "",
    email: "",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop",
    features: ["Elevador", "Portaria 24h"],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isSale = form.transaction === "venda";
    // Venda: total = preço (sem simular financiamento — S006 out-of-scope).
    const total = isSale ? form.salePrice : form.rent + form.condo + form.iptu;
    const pets = PETS_OPTIONS.find((o) => o.value === form.petsOption)?.pets;
    // Campos auxiliares do form (select de pets, input livre) não persistem.
    const { petsOption, customFacility, ...fields } = form;
    addApartment({
      ...fields,
      id: `new-${Date.now()}`,
      total,
      transaction: form.transaction,
      salePrice: isSale ? form.salePrice : undefined,
      rent: isSale ? 0 : form.rent,
      pets,
      description: "Novo imóvel adicionado pelo usuário.",
      features: form.features,
    });
    setOpen(false);
    setForm({ ...form, title: "", neighborhood: "", address: "", link: "", phone: "", email: "" });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-taxi text-ink rounded-md font-semibold hover:bg-taxi-strong transition text-sm"
      >
        <Plus size={16} weight="bold" /> Adicionar Novo Imóvel
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-taxi/40 rounded-xl p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-amberink font-semibold">Novo Imóvel</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" required />
        <input placeholder="Bairro" value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })} className="input-field" required />
        <input placeholder="Link do anúncio (OLX/VivaReal)" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} className="input-field col-span-2" required />
        <input placeholder="Endereço" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input-field col-span-2" />
        <input placeholder="Telefone (ex: (41) 99999-9999)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
        <input placeholder="E-mail" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
        <select
          aria-label="Tipo de transação"
          value={form.transaction}
          onChange={e => setForm({ ...form, transaction: e.target.value as "aluguel" | "venda" })}
          className="input-field col-span-2 cursor-pointer"
        >
          <option value="aluguel">Aluguel</option>
          <option value="venda">Venda</option>
        </select>
        {form.transaction === "venda" ? (
          <input type="number" placeholder="Preço de venda (R$)" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: Number(e.target.value) })} className="input-field" />
        ) : (
          <input type="number" placeholder="Aluguel (R$)" value={form.rent} onChange={e => setForm({ ...form, rent: Number(e.target.value) })} className="input-field" />
        )}
        <input type="number" placeholder="Condomínio (R$)" value={form.condo} onChange={e => setForm({ ...form, condo: Number(e.target.value) })} className="input-field" />
        <input type="number" placeholder="IPTU (R$)" value={form.iptu} onChange={e => setForm({ ...form, iptu: Number(e.target.value) })} className="input-field" />
        <input type="number" placeholder="Área (m²)" value={form.area} onChange={e => setForm({ ...form, area: Number(e.target.value) })} className="input-field" />
        <input type="number" placeholder="Quartos" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: Number(e.target.value) })} className="input-field" />
        <input type="number" min={0} placeholder="Banheiros" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: Number(e.target.value) })} className="input-field" />
        <input type="number" min={0} placeholder="Vagas" value={form.parking} onChange={e => setForm({ ...form, parking: Number(e.target.value) })} className="input-field" />
        <select
          aria-label="Aceita pets"
          value={form.petsOption}
          onChange={e => setForm({ ...form, petsOption: e.target.value as typeof form.petsOption })}
          className="input-field col-span-2 cursor-pointer"
        >
          {PETS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {/* Facilidades editáveis (S010): chips de constantes + campo livre */}
      <div>
        <p className="text-xs font-medium text-ink-soft mb-2">Facilidades</p>
        <div className="flex flex-wrap gap-1.5">
          {FACILITY_OPTIONS.map((item) => {
            const on = form.features.includes(item);
            return (
              <button
                key={item}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setForm({
                    ...form,
                    features: on
                      ? form.features.filter((f) => f !== item)
                      : [...form.features, item],
                  })
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 min-h-11 rounded-lg border text-xs font-medium transition-colors ${
                  on
                    ? "bg-taxi text-ink border-taxi"
                    : "text-muted border-inputbd hover:border-ink"
                }`}
              >
                {on && <Check size={12} weight="bold" />}
                {item}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            placeholder="Outra facilidade (ex: Churrasqueira)"
            value={form.customFacility}
            onChange={e => setForm({ ...form, customFacility: e.target.value })}
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={() => {
              const v = form.customFacility.trim().replace(/^\w/, (c) => c.toUpperCase());
              if (v && !form.features.includes(v)) {
                setForm({ ...form, features: [...form.features, v], customFacility: "" });
              }
            }}
            className="px-4 min-h-11 rounded-lg text-sm font-semibold border border-inputbd bg-card text-ink hover:border-ink transition-colors shrink-0"
          >
            Adicionar
          </button>
        </div>
      </div>
      <button type="submit" className="w-full py-2 bg-taxi text-ink rounded-md font-bold hover:bg-taxi-strong transition">
        Importar Novo Imóvel
      </button>
    </form>
  );
}
