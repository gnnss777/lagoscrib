"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Bed, Car, MapPin, Ruler, Shower } from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import { priceSuffix } from "@/lib/transaction";
import { formatBRL } from "@/lib/antiDores";
import { cardStaggerDelay, DEFAULT_STAGGER_CAP, DEFAULT_STAGGER_STEP } from "@/lib/motion";
import { useApp, STATUS_LABELS } from "@/lib/AppContext";

interface ApartmentCardProps {
  apartment: Apartment;
  index: number;
  onSelect: (apartment: Apartment) => void;
  compareChecked: boolean;
  onToggleCompare: (apartment: Apartment) => void;
}

export default function ApartmentCard({
  apartment,
  index,
  onSelect,
  compareChecked,
  onToggleCompare,
}: ApartmentCardProps) {
  const { getStatus } = useApp();
  const status = getStatus(apartment.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: cardStaggerDelay(index, DEFAULT_STAGGER_STEP, DEFAULT_STAGGER_CAP),
        ease: [0.4, 0, 0.2, 1],
      }}
      className="card-apartment cursor-pointer group"
      onClick={() => onSelect(apartment)}
    >
      {/* Image (S003: capa default — mini-galeria P2 fora de escopo) */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src={apartment.image}
          alt={apartment.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          priority={index === 0}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-night/80 via-transparent to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span className={`status-badge status-${status}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>

        {/* Comparar (S005): 44px, fora do clique do card */}
        <label
          className={`absolute top-3 right-3 flex items-center gap-1.5 min-w-11 min-h-11 px-2.5 rounded-lg backdrop-blur-sm border text-xs font-medium transition-colors cursor-pointer ${
            compareChecked
              ? "bg-taxi text-ink border-taxi"
              : "bg-night/80 text-paper border-paper/20 hover:border-taxi"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={compareChecked}
            onChange={() => onToggleCompare(apartment)}
            aria-label={`Comparar ${apartment.title}`}
            className="w-5 h-5 shrink-0 accent-taxi"
          />
          Comparar
        </label>

        {/* Price tag (S006: "/mês" só no aluguel) */}
        <div className="absolute bottom-3 right-3">
          <div className="bg-night/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-taxi/40">
            <span className="text-taxi font-mono font-bold text-sm">
              {formatBRL(apartment.total)}
            </span>
            {priceSuffix(apartment) && (
              <span className="text-paper/70 text-xs ml-1">
                {priceSuffix(apartment)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Title & Location */}
        <h3 className="text-ink font-semibold text-base mb-1 line-clamp-1">
          {apartment.title}
        </h3>
        <div className="flex items-center gap-1.5 text-ink-soft text-sm mb-4">
          <MapPin size={14} weight="fill" className="text-amberink" />
          <span className="line-clamp-1">
            {apartment.neighborhood} &middot; Curitiba
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-ink-soft">
          <div className="flex items-center gap-1.5">
            <Bed size={15} />
            <span className="text-sm">{apartment.bedrooms}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shower size={15} />
            <span className="text-sm">{apartment.bathrooms}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Car size={15} />
            <span className="text-sm">{apartment.parking}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Ruler size={15} />
            <span className="text-sm">{apartment.area}m²</span>
          </div>
        </div>

        {/* Prospectar vive no DetailModal (aba Status) — card sem CTAs (F3.1) */}
            </div>
    </motion.div>
  );
}
