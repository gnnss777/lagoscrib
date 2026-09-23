"use client";

import { useState } from "react";
import { Check, CopySimple, WhatsappLogo } from "@phosphor-icons/react";
import { type Apartment } from "@/lib/data";
import { CHECKLIST_ITEMS } from "@/lib/constants";
import { buildChecklistText, buildWhatsAppLink } from "@/lib/antiDores";
import { useApp } from "@/lib/AppContext";

interface VisitChecklistProps {
  apartment: Apartment;
}

// Checklist de visita exportável (S004/UX spec F3): marca→persiste (v2),
// Copiar→feedback, WhatsApp→wa.me de compartilhamento (sem número inventado).
export default function VisitChecklist({ apartment }: VisitChecklistProps) {
  const { getChecklist, toggleChecklistItem } = useApp();
  const [feedback, setFeedback] = useState<string | null>(null);
  const checked = getChecklist(apartment.id);

  const text = buildChecklistText(
    apartment,
    checked,
    CHECKLIST_ITEMS.map((i) => i.id)
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback("Checklist copiado!");
    } catch {
      setFeedback("Falha ao copiar — toque de novo para tentar outra vez.");
    }
  };

  return (
    <div data-testid="checklist" className="space-y-4">
      <p className="text-surface-400 text-sm">
        {checked.length} de {CHECKLIST_ITEMS.length} itens marcados
      </p>

      <ul className="space-y-2">
        {CHECKLIST_ITEMS.map((item) => {
          const done = checked.includes(item.id);
          return (
            <li key={item.id}>
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors min-h-11 ${
                  done
                    ? "bg-gold-400/10 border-gold-400/30 text-surface-50"
                    : "bg-navy-800/30 border-navy-700/30 text-surface-200 hover:border-navy-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggleChecklistItem(apartment.id, item.id)}
                  aria-label={item.label}
                  className="w-5 h-5 shrink-0 accent-gold-400"
                />
                <span className="text-sm flex items-center gap-2">
                  {done && <Check size={14} weight="bold" className="text-gold-400 shrink-0" />}
                  {item.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2.5 min-h-11 rounded-lg text-sm font-medium bg-gold-400 text-navy-950 hover:bg-gold-500 transition-colors"
        >
          <CopySimple size={16} />
          Copiar
        </button>
        <a
          href={buildWhatsAppLink(text)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 min-h-11 rounded-lg text-sm font-medium border border-navy-600 text-surface-50 hover:border-gold-400/50 transition-colors"
        >
          <WhatsappLogo size={16} className="text-gold-400" />
          WhatsApp
        </a>
      </div>

      <p role="status" aria-live="polite" className="text-surface-200 text-sm min-h-6">
        {feedback}
      </p>
    </div>
  );
}
