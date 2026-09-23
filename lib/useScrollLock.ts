// Scroll-lock para modais/views em tela cheia (F1.2/F1.4/F3.6).
// Trava o scroll do <body> enquanto o modal está aberto e restaura o valor
// anterior ao fechar. Hook puro de efeito — sem DOM fora do effect.
import { useEffect } from "react";

export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}
