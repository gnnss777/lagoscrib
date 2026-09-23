"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Bed, Car, LinkSimple, MapPin, Ruler, Shower } from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import { priceSuffix } from "@/lib/transaction";
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
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
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent to-transparent" />

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
              ? "bg-gold-400 text-navy-950 border-gold-400"
              : "bg-navy-950/80 text-surface-50 border-white/10 hover:border-gold-400/50"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={compareChecked}
            onChange={() => onToggleCompare(apartment)}
            aria-label={`Comparar ${apartment.title}`}
            className="w-5 h-5 shrink-0 accent-gold-400"
          />
          Comparar
        </label>

        {/* Price tag (S006: "/mês" só no aluguel) */}
        <div className="absolute bottom-3 right-3">
          <div className="bg-navy-950/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gold-400/20">
            <span className="text-gold-400 font-mono font-bold text-sm">
              {formatCurrency(apartment.total)}
            </span>
            {priceSuffix(apartment) && (
              <span className="text-surface-400 text-xs ml-1">
                {priceSuffix(apartment)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Title & Location */}
        <h3 className="text-surface-50 font-semibold text-base mb-1 line-clamp-1">
          {apartment.title}
        </h3>
        <div className="flex items-center gap-1.5 text-surface-400 text-sm mb-4">
          <MapPin size={14} weight="fill" className="text-gold-400" />
          <span className="line-clamp-1">
            {apartment.neighborhood} &middot; Curitiba
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-surface-400">
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

        {/* Main info: Address + Phone + WhatsApp */}
        <div className="mt-2 mb-3 text-surface-300 text-xs space-y-0.5">
          <div className="line-clamp-1">{apartment.address}</div>
          {apartment.phone ? (
            <a
              href={`https://wa.me/55${apartment.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gold-400 hover:text-gold-300 font-medium"
            >
              <span>📱</span>
              <span>{apartment.phone}</span>
            </a>
          ) : (
            <a
              href={apartment.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gold-400 hover:text-gold-300 font-medium"
            >
              <LinkSimple size={13} />
              <span>{apartment.source ?? "Ver anúncio original"}</span>
            </a>
          )}
        </div>

        {/* Features preview */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {apartment.features.slice(0, 3).map((feature) => (
            <span key={feature} className="tag-pill">
              {feature}
            </span>
          ))}
          {apartment.features.length > 3 && (
            <span className="tag-pill">+{apartment.features.length - 3}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
