import type { Photo } from "@/lib/data";
import { GALLERY_ZOOM_LEVELS } from "@/lib/constants";

// Núcleo puro da galeria (S003). Sem React, sem DOM — TDD RED→GREEN.
// Zoom/pan/swipe são UI e vão para o Playwright (e2e/galeria.spec.ts).

export type ZoomLevel = (typeof GALLERY_ZOOM_LEVELS)[number];

/** Fotos exibíveis: photos[] quando há, senão fallback da capa (empty). */
export function getGalleryPhotos(apartment: {
  image: string;
  photos?: Photo[];
}): Photo[] {
  if (apartment.photos && apartment.photos.length > 0) return apartment.photos;
  return [{ src: apartment.image }];
}

/** Próximo índice com wrap (última → primeira). */
export function nextPhotoIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (((current + 1) % total) + total) % total;
}

/** Índice anterior com wrap (primeira → última). */
export function prevPhotoIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (((current - 1) % total) + total) % total;
}

/** Contador "i/N" (posicional, 1-based). */
export function buildPhotoCounter(index: number, total: number): string {
  return `${index + 1}/${total}`;
}

/**
 * Alt posicional. Nunca inventa cômodo (URLs não dizem o cômodo —
 * manifesto S002): a legenda visível usa photo.caption quando existe.
 */
export function buildPhotoAlt(
  title: string,
  index: number,
  total: number
): string {
  return `${title} — foto ${index + 1} de ${total}`;
}

/** Avança o zoom ciclicamente (1x→2x→4x→1x). Fora da lista → 1x. */
export function cycleZoomLevel(current: number): ZoomLevel {
  const idx = GALLERY_ZOOM_LEVELS.indexOf(current as ZoomLevel);
  if (idx === -1) return 1;
  return GALLERY_ZOOM_LEVELS[(idx + 1) % GALLERY_ZOOM_LEVELS.length];
}
