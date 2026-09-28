"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/lib/useScrollLock";
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
  const titleRef = useRef<HTMLInputElement>(null);
  useScrollLock(open);

  // F1.5 modal a11y: Esc fecha + foco no 1º campo ao abrir.
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
    // Galeria local. Vazio = imóvel digitado à mão, que fica só com a capa.
    photos: [] as { src: string; caption?: string }[],
    features: ["Elevador", "Portaria 24h"],
  });

  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const [linkParaImportar, setLinkParaImportar] = useState("");
  const [importando, setImportando] = useState(false);
  const [importErro, setImportErro] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [fotosImportadas, setFotosImportadas] = useState(0);

  const importarPorLink = async () => {
    setImportErro("");
    setAvisos([]);
    if (!/^https?:\/\//i.test(linkParaImportar)) {
      setImportErro("Cole a URL completa do anúncio.");
      return;
    }
    setImportando(true);
    try {
      const r = await fetch("/api/import/imovel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: linkParaImportar }),
      });
      const j = await r.json();
      if (!r.ok) {
        // 401 = sem sessão do NextAuth. O app abre sem login, então quem nunca
        // entrou não tem cookie: nesse caso a rota /api/import responde 401 e o
        // import por link não é possível. "Sair" no cabeçalho leva ao login.
        setImportErro(
          r.status === 401
            ? "Faça login para importar (botão “Sair” no cabeçalho) — a importação usa a sessão, e o app abre direto sem ela."
            : (j?.error ?? `Falha no import (HTTP ${r.status})`),
        );
        return;
      }
      const a = j.imovel;
      // Só sobrescreve o que a página realmente disse. Campo que veio 0
      // (quartos, banheiros, vaga) mantém o valor que o usuário já digitou,
      // senão o import apagaria preenchimento manual.
      setForm((f) => ({
        ...f,
        title: a.title || f.title,
        neighborhood: a.neighborhood || f.neighborhood,
        address: a.address || f.address,
        link: a.link || f.link,
        area: a.area || f.area,
        bedrooms: a.bedrooms || f.bedrooms,
        bathrooms: a.bathrooms || f.bathrooms,
        parking: a.parking || f.parking,
        rent: a.rent || f.rent,
        condo: a.condo,
        iptu: a.iptu,
        image: a.image || f.image,
        photos: a.photos?.length ? a.photos : f.photos,
      }));
      setAvisos(j.avisos ?? []);
      setFotosImportadas(j.fotosBaixadas ?? 0);
    } catch (e) {
      setImportErro(String(e).slice(0, 160));
    } finally {
      setImportando(false);
    }
  };

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
      // Importado por link tem descrição e galeria de verdade; digitado à mão
      // não, e aí o app mostra só a capa (o resto da base também tem).
      description: form.photos.length
        ? "Imóvel importado do link do anúncio."
        : "Novo imóvel adicionado pelo usuário.",
      features: form.features,
    });
    setOpen(false);
    // Limpa galeria e capa junto: senão as fotos do imóvel importado anterior
    // ficam presas no imóvel que o usuário cadastrar em seguida.
    setForm({
      ...form,
      title: "",
      neighborhood: "",
      address: "",
      link: "",
      phone: "",
      email: "",
      photos: [],
      image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop",
    });
    setLinkParaImportar("");
    setAvisos([]);
    setFotosImportadas(0);
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto bg-night/60"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Adicionar novo imóvel"
        className="relative w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
    <form onSubmit={handleSubmit} className="bg-card border border-taxi/40 rounded-xl p-5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-amberink font-semibold">Novo Imóvel</h4>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar formulário" className="text-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>

      {/* Import por link: cola a URL do anúncio e os campos se preenchem. O
          usuário ainda revisa e corrige o que a página não disse (os avisos
          ficam visíveis) antes de salvar — o import não inventa valor. */}
      <div className="rounded-lg border border-taxi/30 bg-night/40 p-3 space-y-2">
        <label className="block text-xs text-muted">
          Colar link do anúncio para preencher sozinho (Zap, VivaReal, OLX, Chaves na Mão)
        </label>
        <div className="flex gap-2">
          <input
            placeholder="https://..."
            value={linkParaImportar}
            onChange={(e) => setLinkParaImportar(e.target.value)}
            className="input-field flex-1"
            aria-label="Link do anúncio para importar"
          />
          <button
            type="button"
            onClick={importarPorLink}
            disabled={importando}
            className="rounded-md bg-taxi px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {importando ? "Lendo…" : "Preencher"}
          </button>
        </div>
        {importErro && <p className="text-xs text-red-300">{importErro}</p>}
        {avisos.length > 0 && (
          <ul className="text-xs text-amberink space-y-0.5">
            {avisos.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        )}
        {fotosImportadas > 0 && (
          <p className="text-xs text-muted">
            {fotosImportadas} foto{fotosImportadas > 1 ? "s" : ""} baixada
            {fotosImportadas > 1 ? "s" : ""} para o app.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input ref={titleRef} placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field" required />
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
      </div>
    </div>
  );
}
