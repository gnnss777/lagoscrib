"use client";

import { CloudArrowUp } from "@phosphor-icons/react";
import { useApp } from "@/lib/AppContext";

/**
 * Indicador de sincronização entre aparelhos.
 *
 * Antes este componente era um portão: o dono digitava um código para ligar o
 * sync em cada aparelho. O código virou o cookie de sessão do login, então não
 * há mais nada para configurar aqui — quem está logado já sincroniza, e quem
 * não está nem vê o app. Sobrou só o indicador.
 *
 * Por que não apagar: sem ele o dono perde a única pista de que o estado está
 * indo para o servidor. Ele é passivo de propósito; nada de clique.
 */
export function SyncGate() {
  const { syncEnabled, syncStatus } = useApp();

  if (!syncEnabled) return null;

  const rotulo =
    syncStatus === "syncing"
      ? "Sincronizando"
      : syncStatus === "error"
        ? "Sync falhou"
        : syncStatus === "denied"
          ? "Sessão expirada"
          : "Sincronizado";

  return (
    <div
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-xs font-medium text-ink-soft shadow-sm"
      title="O kanban, os excluídos, notas e checklist são compartilhados entre seus aparelhos. Quem edita por último manda."
    >
      <CloudArrowUp
        size={14}
        className={syncStatus === "error" || syncStatus === "denied" ? "text-red-500" : "text-amberink"}
      />
      {rotulo}
    </div>
  );
}
