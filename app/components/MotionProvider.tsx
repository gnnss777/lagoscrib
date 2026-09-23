"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

// F1.3 / DESIGN §6: acessa `prefers-reduced-motion` do OS uma única vez no
// nível do app (MotionConfig `reducedMotion="user"`). O MotionConfig propaga
// `useReducedMotion()` para todos os `motion.*` — quando o usuário pede
// movimento reduzido, stagger/entradas horizontais são desligados automaticamente
// (invariante #8 do estúdio). Sem MotionConfig por view — uma fonte só.
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  );
}
