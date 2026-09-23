"use client";

import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { useApp } from "@/lib/AppContext";

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
    addApartment({
      ...form,
      id: `new-${Date.now()}`,
      total,
      transaction: form.transaction,
      salePrice: isSale ? form.salePrice : undefined,
      rent: isSale ? 0 : form.rent,
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
        className="flex items-center gap-2 px-4 py-2 bg-gold-400 text-navy-950 rounded-md font-semibold hover:bg-gold-500 transition text-sm"
      >
        <Plus size={16} weight="bold" /> Adicionar Novo Imóvel
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-navy-900 border border-gold-400/20 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-gold-400 font-semibold">Novo Imóvel</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-50">
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
      </div>
      <button type="submit" className="w-full py-2 bg-gold-400 text-navy-950 rounded-md font-bold hover:bg-gold-500 transition">
        Importar Novo Imóvel
      </button>
    </form>
  );
}
