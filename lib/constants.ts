// Constantes centralizadas da leva dores-consumidor (ADR-002 §5).
// REGRA: nenhum valor monetário/faixa/taxa hardcoded em componente —
// tudo aqui, com comentário da fonte. Hardcode fora = erro de review (LL-006).

// --- Precificação (S001) ---
// Casas decimais do preço/m² exibido (padrão dos portais: 1 casa, ex. R$ 3.577,8/m²).
export const PRICE_PER_M2_DECIMALS = 1;

// Locale/moeda do Intl.NumberFormat em toda a UI (DESIGN.md §7).
export const CURRENCY_LOCALE = "pt-BR";
export const CURRENCY_CODE = "BRL";

// --- Galeria (S003, DESIGN.md §4/§10, ADR-002 decisão 1) ---
// Níveis de zoom do lightbox (1x→2x→4x, cíclico). Componente só lê daqui.
// Teto da implementação própria: se ImageLightbox.tsx estourar ~250 linhas,
// trocar pelo fallback yet-another-react-lightbox (ADR-002).
export const GALLERY_ZOOM_LEVELS = [1, 2, 4] as const;
export const GALLERY_OWN_IMPL_MAX_LINES = 250;
