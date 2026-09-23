"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/lib/useScrollLock";
import Image from "next/image";
import { X, CaretLeft, CaretRight, MagnifyingGlassPlus } from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import type { Photo } from "@/lib/data";
import {
  buildPhotoAlt,
  buildPhotoCounter,
  cycleZoomLevel,
  nextPhotoIndex,
  prevPhotoIndex,
} from "@/lib/gallery";

interface ImageLightboxProps {
  photos: Photo[];
  index: number;
  title: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

// Lightbox próprio (ADR-002 decisão 1): fullscreen + zoom 1x→2x→4x + pan.
// Teclado: ←/→ navega, +/- zoom, 0 reseta, Esc fecha. Sem lib externa.
export default function ImageLightbox({
  photos,
  index,
  title,
  onIndexChange,
  onClose,
}: ImageLightboxProps) {
  const total = photos.length;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  useScrollLock();

  const photo = photos[index];
  const counter = buildPhotoCounter(index, total);
  const alt = buildPhotoAlt(title, index, total);

  const goTo = useCallback(
    (i: number) => {
      onIndexChange(((i % total) + total) % total);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    },
    [onIndexChange, total]
  );

  // Foco no fechar ao abrir (a11y); Esc fecha (UX spec AC-ZOOM-01).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
      else if (e.key === "+" || e.key === "=") setZoom((z) => cycleZoomLevel(z));
      else if (e.key === "-" || e.key === "_")
        setZoom((z) => (z === 4 ? 2 : z === 2 ? 1 : 4));
      else if (e.key === "0") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, onClose]);

  if (!photo) return null;

  const clampPan = (x: number, y: number) => {
    const max = 160 * zoom;
    return {
      x: Math.max(-max, Math.min(max, x)),
      y: Math.max(-max, Math.min(max, y)),
    };
  };

  return (
    <div
      data-testid="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — ${counter}`}
      className="fixed inset-0 z-[60] bg-night/95 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      {/* Barra superior */}
      <div
        className="flex items-center justify-between px-4 h-16 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span data-testid="lightbox-counter" className="text-paper font-mono text-sm">
          {counter}
        </span>
        <div className="flex items-center gap-2">
          <button
            data-testid="lightbox-zoom"
            aria-label={`Zoom ${zoom}x — ativar para ${cycleZoomLevel(zoom)}x`}
            onClick={() => setZoom((z) => cycleZoomLevel(z))}
            className="min-w-11 min-h-11 px-3 flex items-center justify-center gap-1.5 rounded-lg border border-paper/25 text-paper hover:border-taxi transition-colors text-sm font-mono"
          >
            <MagnifyingGlassPlus size={18} className="text-taxi" />
            {zoom}x
          </button>
          <button
            ref={closeRef}
            aria-label="Fechar zoom (Esc)"
            onClick={onClose}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg border border-paper/25 text-paper hover:border-taxi transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Foto (clique alterna zoom; arrastar move com zoom > 1) */}
      <div
        className="relative flex-1 overflow-hidden touch-none select-none"
        style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
        onClick={(e) => {
          e.stopPropagation();
          setZoom((z) => cycleZoomLevel(z));
        }}
        onPointerDown={(e) => {
          if (zoom === 1) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!dragging || zoom === 1) return;
          setPan(
            clampPan(
              dragStart.current.panX + (e.clientX - dragStart.current.x),
              dragStart.current.panY + (e.clientY - dragStart.current.y)
            )
          );
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <div
          className="absolute inset-0"
          style={
            reduceMotion
              ? { transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` }
              : {
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }
          }
        >
          <Image
            key={photo.src}
            src={photo.src}
            alt={alt}
            fill
            sizes="100vw"
            className="object-contain"
            priority
            draggable={false}
          />
        </div>
      </div>

      {/* Rodapé: legenda + setas */}
      <div
        className="flex items-center justify-between gap-2 px-4 h-16 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Foto anterior"
          onClick={() => goTo(prevPhotoIndex(index, total))}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg border border-paper/25 text-paper hover:border-taxi transition-colors"
        >
          <CaretLeft size={20} />
        </button>
        <p className="text-paper text-sm text-center line-clamp-1 flex-1">
          {photo.caption ?? `Foto ${index + 1} de ${total}`}
        </p>
        <button
          aria-label="Próxima foto"
          onClick={() => goTo(nextPhotoIndex(index, total))}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg border border-paper/25 text-paper hover:border-taxi transition-colors"
        >
          <CaretRight size={20} />
        </button>
      </div>
    </div>
  );
}
