// Utilidades de motion para o dashboard do lagoscrib (F1.3 — stagger com cap).
// Funções puras, sem DOM — testáveis em vitest.

export const DEFAULT_STAGGER_STEP = 0.08;
export const DEFAULT_STAGGER_CAP = 12;

/**
 * Atraso de stagger para cards em lista. Sem cap, o card N estaría esperando
 * N*step segundos — com cap, tudo além de `cap` entra no mesmo tempo do último
 * capado (evita lista longa com entradas de segundos). `reducedMotion="user"`
 * no MotionProvider já neutraliza tudo para quem pede movimento reduzido.
 */
export function cardStaggerDelay(
  index: number,
  step: number = DEFAULT_STAGGER_STEP,
  cap?: number,
): number {
  const safeStep = Math.max(0, step);
  const safeIndex = Math.max(0, Math.floor(index));
  // Sem cap explícito = crescimento linear (modo legado); com cap, trava no
  // teto para listas longas não enfileirarem segundos de animação.
  if (cap === undefined) return safeIndex * safeStep;
  const safeCap = Math.max(0, Math.floor(cap));
  return Math.min(safeIndex, safeCap) * safeStep;
}
