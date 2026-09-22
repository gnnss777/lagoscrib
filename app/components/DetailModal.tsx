"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  X,
  Bed,
  Car,
  MapPin,
  Ruler,
  Shower,
  Phone,
  Envelope,
  LinkSimple,
  Calendar,
  NotePencil,
  Check,
  Clock,
  CaretLeft,
  CaretRight,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import {
  buildPhotoAlt,
  buildPhotoCounter,
  getGalleryPhotos,
  nextPhotoIndex,
  prevPhotoIndex,
} from "@/lib/gallery";
import ImageLightbox from "./ImageLightbox";
import {
  useApp,
  STATUS_LABELS,
  type StatusType,
} from "@/lib/AppContext";

interface DetailModalProps {
  apartment: Apartment | null;
  onClose: () => void;
}

const STATUSES: StatusType[] = [
  "novo",
  "agendado",
  "feita",
  "negociacao",
  "aprovado",
  "recusado",
];

export default function DetailModal({ apartment, onClose }: DetailModalProps) {
  const { getStatus, updateStatus, addNote, getNotes } = useApp();
  const [activeTab, setActiveTab] = useState<"details" | "notes">("details");
  const [newNote, setNewNote] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  // Galeria viewer-first (S003): índice, lightbox, falhas de carga (pula slide).
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set());
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // Troca de imóvel = remount via key={apartment.id} no Dashboard:
  // índice/lightbox/falhas sempre começam zerados, sem effect.

  // Teclado da galeria (UX spec F1/AC-GAL-02): ←/→ navegam, Esc fecha o modal.
  // (Com lightbox aberto, o Esc dele prevalece — o keydown dele fecha primeiro.)
  useEffect(() => {
    if (!apartment || lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apartment, lightboxOpen, onClose]);

  if (!apartment) return null;

  const allPhotos = getGalleryPhotos(apartment);
  const photos = allPhotos.filter((p) => !failedSrcs.has(p.src));
  const hasPhotos = photos.length > 0;
  const safeIndex = hasPhotos ? photoIndex % photos.length : 0;
  const currentPhoto = hasPhotos ? photos[safeIndex] : null;
  const counter = hasPhotos ? buildPhotoCounter(safeIndex, photos.length) : null;

  const goToPhoto = (i: number) => {
    if (!hasPhotos) return;
    setPhotoIndex(((i % photos.length) + photos.length) % photos.length);
  };

  const markFailed = (src: string) =>
    setFailedSrcs((prev) => new Set(prev).add(src));

  const status = getStatus(apartment.id);
  const notes = getNotes(apartment.id);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);

  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateString));

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNote(apartment.id, newNote.trim());
      setNewNote("");
    }
  };

  const handleStatusChange = (newStatus: StatusType) => {
    updateStatus(
      apartment.id,
      newStatus,
      newStatus === "agendado" ? scheduledDate : undefined
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="detail-overlay fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto"
        onClick={onClose}
      >
        {/* Backdrop blur close */}
        <div className="fixed inset-0" />

        {/* Modal content */}
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative w-full max-w-2xl bg-navy-900 border border-navy-700/50 rounded-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Galeria viewer-first (S003): principal 4:3 + thumbs + contador + legenda */}
          <div data-testid="gallery">
            <div
              className="relative aspect-[4/3] bg-navy-950"
              onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchStartX === null) return;
                const dx = e.changedTouches[0].clientX - touchStartX;
                setTouchStartX(null);
                if (dx > 40) goToPhoto(prevPhotoIndex(safeIndex, photos.length));
                else if (dx < -40) goToPhoto(nextPhotoIndex(safeIndex, photos.length));
              }}
            >
              {currentPhoto ? (
                <button
                  data-testid="gallery-main"
                  aria-label={`Ampliar foto ${counter} de ${apartment.title}`}
                  onClick={() => setLightboxOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight")
                      goToPhoto(nextPhotoIndex(safeIndex, photos.length));
                    else if (e.key === "ArrowLeft")
                      goToPhoto(prevPhotoIndex(safeIndex, photos.length));
                  }}
                  className="absolute inset-0 w-full h-full cursor-zoom-in"
                >
                  <Image
                    key={currentPhoto.src}
                    src={currentPhoto.src}
                    alt={buildPhotoAlt(apartment.title, safeIndex, photos.length)}
                    fill
                    sizes="(max-width: 672px) 100vw, 672px"
                    className="object-cover"
                    priority={safeIndex === 0}
                    onError={() => markFailed(currentPhoto.src)}
                  />
                </button>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-surface-500">
                  <Image
                    src={apartment.image}
                    alt={apartment.title}
                    fill
                    sizes="(max-width: 672px) 100vw, 672px"
                    className="object-cover opacity-40"
                  />
                  <p className="relative text-sm bg-navy-950/70 px-3 py-1.5 rounded-lg">
                    Fotos indisponíveis — veja o anúncio original
                  </p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/40 to-transparent pointer-events-none" />

              {/* Contador */}
              {counter && (
                <span
                  data-testid="gallery-counter"
                  className="absolute top-4 left-4 px-2.5 py-1 rounded-lg bg-navy-950/70 backdrop-blur-sm border border-white/10 text-surface-50 font-mono text-xs"
                >
                  {counter}
                </span>
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                aria-label="Fechar detalhes (Esc)"
                className="absolute top-4 right-4 min-w-11 min-h-11 flex items-center justify-center bg-navy-950/60 backdrop-blur-sm rounded-full border border-white/10 text-surface-50 hover:bg-navy-950/80 transition-colors"
              >
                <X size={20} />
              </button>

              {/* Setas */}
              {photos.length > 1 && (
                <>
                  <button
                    data-testid="gallery-prev"
                    aria-label="Foto anterior"
                    onClick={() => goToPhoto(prevPhotoIndex(safeIndex, photos.length))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center bg-navy-950/60 backdrop-blur-sm rounded-full border border-white/10 text-surface-50 hover:bg-navy-950/80 transition-colors"
                  >
                    <CaretLeft size={20} />
                  </button>
                  <button
                    data-testid="gallery-next"
                    aria-label="Próxima foto"
                    onClick={() => goToPhoto(nextPhotoIndex(safeIndex, photos.length))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center bg-navy-950/60 backdrop-blur-sm rounded-full border border-white/10 text-surface-50 hover:bg-navy-950/80 transition-colors"
                  >
                    <CaretRight size={20} />
                  </button>
                </>
              )}

              {/* Ampliar */}
              {currentPhoto && (
                <button
                  aria-label="Abrir zoom da foto"
                  onClick={() => setLightboxOpen(true)}
                  className="absolute bottom-4 right-4 min-w-11 min-h-11 flex items-center justify-center gap-1.5 px-3 bg-navy-950/60 backdrop-blur-sm rounded-lg border border-white/10 text-surface-50 hover:bg-navy-950/80 transition-colors text-xs"
                >
                  <MagnifyingGlassPlus size={16} className="text-gold-400" />
                  Ampliar
                </button>
              )}

              {/* Title overlay */}
              <div className="absolute bottom-4 left-6 right-24 pointer-events-none">
                <h2 className="text-xl font-bold text-surface-50 mb-1">
                  {apartment.title}
                </h2>
                <div className="flex items-center gap-1.5 text-surface-200 text-sm">
                  <MapPin size={14} weight="fill" className="text-gold-400" />
                  {apartment.address}
                </div>
              </div>
            </div>

            {/* Legenda + thumbs */}
            {currentPhoto && (
              <div className="px-6 pt-3">
                <p data-testid="gallery-caption" className="text-surface-200 text-sm line-clamp-1">
                  {currentPhoto.caption ?? `Foto ${safeIndex + 1} de ${photos.length}`}
                </p>
              </div>
            )}
            {photos.length > 1 && (
              <div
                data-testid="gallery-thumbs"
                className="flex gap-2 overflow-x-auto px-6 pt-3 pb-1"
                role="group"
                aria-label="Miniaturas das fotos"
              >
                {photos.map((p, i) => (
                  <button
                    key={p.src}
                    aria-label={`Ir para foto ${i + 1}`}
                    aria-pressed={i === safeIndex}
                    onClick={() => goToPhoto(i)}
                    className={`relative w-20 h-14 shrink-0 rounded-xl overflow-hidden border transition-colors ${
                      i === safeIndex
                        ? "border-gold-400 ring-2 ring-gold-400/50"
                        : "border-navy-700/50 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={p.src}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      loading="lazy"
                      onError={() => markFailed(p.src)}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-navy-700/50 pb-4">
              <button
                onClick={() => setActiveTab("details")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "details"
                    ? "bg-gold-400/10 text-gold-400 border border-gold-400/20"
                    : "text-surface-400 hover:text-surface-50"
                }`}
              >
                Detalhes
              </button>
              <button
                onClick={() => setActiveTab("notes")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === "notes"
                    ? "bg-gold-400/10 text-gold-400 border border-gold-400/20"
                    : "text-surface-400 hover:text-surface-50"
                }`}
              >
                <NotePencil size={14} />
                Notas ({notes.length})
              </button>
            </div>

            {activeTab === "details" && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { icon: Bed, label: "Quartos", value: apartment.bedrooms },
                    { icon: Shower, label: "Banheiros", value: apartment.bathrooms },
                    { icon: Car, label: "Vagas", value: apartment.parking },
                    { icon: Ruler, label: "Área", value: `${apartment.area}m²` },
                  ].map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-1.5 p-3 bg-navy-800/50 rounded-xl"
                    >
                      <Icon size={20} className="text-gold-400" />
                      <span className="text-surface-50 font-semibold text-sm">
                        {value}
                      </span>
                      <span className="text-surface-500 text-xs">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Price breakdown */}
                <div className="bg-navy-800/30 rounded-xl p-4 border border-navy-700/30">
                  <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                    Valores Mensais
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-400">Aluguel</span>
                      <span className="text-surface-50 font-mono">
                        {formatCurrency(apartment.rent)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-400">Condomínio</span>
                      <span className="text-surface-50 font-mono">
                        {formatCurrency(apartment.condo)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-surface-400">IPTU</span>
                      <span className="text-surface-50 font-mono">
                        {formatCurrency(apartment.iptu)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-navy-700/50 flex justify-between">
                      <span className="text-surface-50 font-semibold text-sm">
                        Total
                      </span>
                      <span className="text-gold-400 font-mono font-bold text-lg">
                        {formatCurrency(apartment.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                    Características
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {apartment.features.map((feature) => (
                      <span key={feature} className="tag-pill">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status workflow */}
                <div>
                  <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                    Status do Contato
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={`status-badge ${
                          status === s
                            ? `status-${s} ring-2 ring-offset-1 ring-offset-navy-900 ring-gold-400/50`
                            : `status-${s} opacity-60 hover:opacity-100`
                        }`}
                      >
                        {status === s && <Check size={12} weight="bold" />}
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>

                  {status === "agendado" && (
                    <div className="mt-3 flex items-center gap-2">
                      <Calendar size={16} className="text-gold-400" />
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setScheduledDate(val);
                          updateStatus(apartment.id, "agendado", val || undefined);
                        }}
                        className="input-field max-w-[200px] py-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Contact */}
                <div className="bg-navy-800/30 rounded-xl p-4 border border-navy-700/30">
                  <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                    Contato
                  </h4>
                  <div className="space-y-2">
                    {apartment.phone && (
                      <a
                        href={`tel:${apartment.phone}`}
                        className="flex items-center gap-3 text-surface-50 hover:text-gold-400 transition-colors"
                      >
                        <Phone size={16} className="text-gold-400" />
                        <span className="text-sm">{apartment.phone}</span>
                      </a>
                    )}
                    {apartment.email && (
                      <a
                        href={`mailto:${apartment.email}`}
                        className="flex items-center gap-3 text-surface-50 hover:text-gold-400 transition-colors"
                      >
                        <Envelope size={16} className="text-gold-400" />
                        <span className="text-sm">{apartment.email}</span>
                      </a>
                    )}
                    <a
                      href={apartment.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-surface-50 hover:text-gold-400 transition-colors"
                    >
                      <LinkSimple size={16} className="text-gold-400" />
                      <span className="text-sm">Ver anúncio original</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "notes" && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                {/* Add note */}
                <div className="flex gap-3">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Adicionar nota de visita ou negociação..."
                    className="input-field flex-1 min-h-[80px] resize-none"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="btn-primary self-end disabled:opacity-40 disabled:cursor-not-allowed h-[44px]"
                  >
                    <Check size={18} weight="bold" />
                  </button>
                </div>

                {/* Notes list */}
                <div className="space-y-3">
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-surface-500">
                      <NotePencil size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma nota ainda</p>
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="bg-navy-800/30 rounded-xl p-4 border border-navy-700/30"
                      >
                        <p className="text-surface-50 text-sm whitespace-pre-wrap">
                          {note.text}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 text-surface-500 text-xs">
                          <Clock size={12} />
                          {formatDate(note.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Lightbox fullscreen (S003) — foco volta à galeria ao fechar */}
        {lightboxOpen && hasPhotos && (
          <ImageLightbox
            photos={photos}
            index={safeIndex}
            title={apartment.title}
            onIndexChange={goToPhoto}
            onClose={() => {
              setLightboxOpen(false);
              panelRef.current?.querySelector<HTMLElement>('[data-testid="gallery-main"]')?.focus();
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
