"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  SignOut,
  MagnifyingGlass,
  FunnelSimple,
  Buildings,
  MapPin,
} from "@phosphor-icons/react";
import { apartments as staticApartments, type Apartment } from "@/lib/data";
import { useApp, STATUS_LABELS, type StatusType } from "@/lib/AppContext";
import ApartmentCard from "./ApartmentCard";
import AddApartmentForm from "./AddApartmentForm";
import DetailModal from "./DetailModal";

const NEIGHBORHOODS = [
  "Todos",
  ...Array.from(new Set(staticApartments.map((a) => a.neighborhood))),
];

// Combinar apartamentos estáticos com novos adicionados pelo usuário
const getAllApartments = (): Apartment[] => {
  try {
    const stored = localStorage.getItem("apartamentos-app-new");
    if (stored) {
      const newApts: Apartment[] = JSON.parse(stored);
      return [...staticApartments, ...newApts];
    }
  } catch {
    // ignore
  }
  return staticApartments;
};

const STATUS_FILTERS: { value: StatusType | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "novo", label: "Não visitado" },
  { value: "agendado", label: "Agendado" },
  { value: "feita", label: "Visita feita" },
  { value: "negociacao", label: "Negociação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "recusado", label: "Recusado" },
];

export default function Dashboard() {
  const { username, logout, getStatus } = useApp();
  const [search, setSearch] = useState("");
  const [neighborhood, setNeighborhood] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState<StatusType | "todos">("todos");
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(
    null
  );

  const allApartments = getAllApartments();

  const filteredApartments = useMemo(() => {
    return allApartments.filter((apt) => {
      const matchesSearch =
        search === "" ||
        apt.title.toLowerCase().includes(search.toLowerCase()) ||
        apt.neighborhood.toLowerCase().includes(search.toLowerCase()) ||
        apt.address.toLowerCase().includes(search.toLowerCase());

      const matchesNeighborhood =
        neighborhood === "Todos" || apt.neighborhood === neighborhood;

      const status = getStatus(apt.id);
      const matchesStatus = statusFilter === "todos" || status === statusFilter;

      return matchesSearch && matchesNeighborhood && matchesStatus;
    });
  }, [search, neighborhood, statusFilter, getStatus]);

  const stats = useMemo(() => {
    const all = allApartments.map((a) => ({ ...a, status: getStatus(a.id) }));
    return {
      total: all.length,
      novo: all.filter((a) => a.status === "novo").length,
      agendado: all.filter((a) => a.status === "agendado").length,
      feita: all.filter((a) => a.status === "feita").length,
      negociacao: all.filter((a) => a.status === "negociacao").length,
      aprovado: all.filter((a) => a.status === "aprovado").length,
      recusado: all.filter((a) => a.status === "recusado").length,
    };
  }, [getStatus]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-navy-950/80 backdrop-blur-md border-b border-navy-700/30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center">
              <Buildings size={20} weight="bold" className="text-navy-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-50 tracking-tight">
                Curitiba Apartamentos
              </h1>
              <p className="text-xs text-surface-500">
                {allApartments.length} apartamentos encontrados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-surface-400 hidden sm:block">
              Olá, <span className="text-gold-400 font-medium">{username}</span>
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 text-surface-400 hover:text-surface-50 hover:bg-navy-800/50 rounded-lg transition-colors text-sm"
            >
              <SignOut size={16} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8"
        >
          {[
            { label: "Total", value: stats.total, color: "text-surface-50" },
            { label: "Novos", value: stats.novo, color: "text-surface-400" },
            { label: "Agendados", value: stats.agendado, color: "text-blue-400" },
            { label: "Feitas", value: stats.feita, color: "text-purple-400" },
            { label: "Negociação", value: stats.negociacao, color: "text-gold-400" },
            { label: "Aprovados", value: stats.aprovado, color: "text-green-400" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-navy-900/50 border border-navy-700/30 rounded-xl p-3 text-center"
            >
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-surface-500 mt-0.5">{label}</div>
            </div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-8"
        >
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlass
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, bairro ou endereço..."
              className="input-field pl-12"
            />
          </div>

          {/* Neighborhood filter */}
          <div className="relative">
            <MapPin
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
            />
            <select
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="input-field pl-10 pr-8 appearance-none cursor-pointer min-w-[160px]"
            >
              {NEIGHBORHOODS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="relative">
            <FunnelSimple
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusType | "todos")
              }
              className="input-field pl-10 pr-8 appearance-none cursor-pointer min-w-[160px]"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-surface-400">
            {filteredApartments.length === allApartments.length
              ? "Mostrando todos os apartamentos"
              : `${filteredApartments.length} de ${allApartments.length} apartamentos`}
          </p>
        </div>

        {/* Add new apartment */}
        <div className="mb-6">
          <AddApartmentForm />
        </div>

        {/* Grid */}
        {filteredApartments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApartments.map((apartment, index) => (
              <ApartmentCard
                key={apartment.id}
                apartment={apartment}
                index={index}
                onSelect={setSelectedApartment}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Buildings size={48} className="mx-auto text-surface-500 mb-4" />
            <p className="text-surface-400 text-lg mb-2">
              Nenhum apartamento encontrado
            </p>
            <p className="text-surface-500 text-sm">
              Tente ajustar os filtros de busca
            </p>
          </motion.div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedApartment && (
        <DetailModal
          apartment={selectedApartment}
          onClose={() => setSelectedApartment(null)}
        />
      )}
    </div>
  );
}
