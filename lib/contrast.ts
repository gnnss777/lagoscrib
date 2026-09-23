// Utilitários WCAG 2.1/2.2 de luminância relativa e razão de contraste.
// Puros e determinísticos (sem I/O) — usados pela trava AAA do tema
// (tests/unit/lightbox-contrast.test.ts) e legíveis por qualquer agente.

function channelToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminância relativa de um hex `#rrggbb` (0–1). */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`hex inválido para contraste: ${hex}`);
  const r = channelToLinear(parseInt(m[1].slice(0, 2), 16));
  const g = channelToLinear(parseInt(m[1].slice(2, 4), 16));
  const b = channelToLinear(parseInt(m[1].slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre dois hex (1–21). */
export function contrastRatio(fg: string, bg: string): number {
  const [l1, l2] = [relativeLuminance(fg), relativeLuminance(bg)].sort(
    (a, b) => b - a,
  );
  return (l1 + 0.05) / (l2 + 0.05);
}
