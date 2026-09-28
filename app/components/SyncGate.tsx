"use client";

import { useState } from "react";
import { CloudArrowUp, Warning, X } from "@phosphor-icons/react";
import { useApp } from "@/lib/AppContext";

/**
 * Liga o sync entre dispositivos.
 *
 * O código é pedido UMA vez por aparelho e fica no localStorage dele. Não é
 * NEXT_PUBLIC_ de propósito: embutido no bundle ele vira público (o mesmo erro
 * que a senha de login em `buildLegacyUsers` já comete) e qualquer pessoa que
 * abrisse o app leria o código e reescreveria o estado do dono.
 *
 * Entrada não-bloqueante: um chip no canto, não um modal no load. Forçar o modal
 * na primeira visita esconderia a lista de imóveis atrás de uma caixa de diálogo.
 */
export function SyncGate() {
  const { syncEnabled, syncStatus, enableSync, disableSync } = useApp();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState(false);
  const [code, setCode] = useState("");

  const tone =
    syncStatus === "error" || syncStatus === "denied"
      ? "text-red-500"
      : syncStatus === "syncing"
        ? "text-amberink"
        : "text-green-600";
  const label =
    syncStatus === "syncing"
      ? "Sincronizando"
      : syncStatus === "error"
        ? "Sync falhou"
        : syncStatus === "denied"
          ? "Código inválido"
          : "Sincronizado";

  return (
    <>
      {syncEnabled ? (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanel((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-xs font-medium text-ink-soft shadow-sm hover:text-ink"
            aria-label="Estado da sincronização"
          >
            <CloudArrowUp size={14} className={tone} />
            {label}
          </button>
          {panel && (
            <div className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-soft shadow-lg">
              <p className="mb-1 font-semibold text-ink">Sincronização</p>
              <p className="mb-3 max-w-60 text-xs">
                O kanban, os excluídos, notas e checklist ficam iguais em todos os
                aparelhos. Quem edita por último manda.
              </p>
              <button
                type="button"
                onClick={() => {
                  disableSync();
                  setPanel(false);
                }}
                className="text-xs font-semibold text-red-500 hover:underline"
              >
                Desligar neste aparelho
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-line bg-card px-3 py-2 text-xs font-medium text-ink-soft shadow-sm hover:text-ink"
        >
          <CloudArrowUp size={14} className="text-amberink" />
          Sincronizar entre aparelhos
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Sincronizar entre aparelhos"
          className="fixed inset-0 z-50 flex items-end justify-center bg-night/60 p-4 sm:items-center"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <CloudArrowUp size={20} weight="bold" className="text-amberink" />
                Sincronizar entre aparelhos
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded-md p-1 text-ink-soft hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-4 text-sm text-ink-soft">
              Hoje o que você mexe — kanban, apartamento excluído, notas — fica
              só neste navegador. Cole o código para o outro aparelho ver igual.
            </p>

            <label
              className="mb-1 block text-xs font-semibold text-ink"
              htmlFor="sync-token"
            >
              Código de sincronização
            </label>
            <input
              id="sync-token"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="cole o código aqui"
              autoComplete="off"
              className="input-field mb-3 w-full"
            />

            <p className="mb-4 flex items-start gap-2 rounded-lg border border-taxi/40 bg-pastel px-3 py-2 text-xs text-amberink">
              <Warning size={14} className="mt-0.5 shrink-0" />
              Guarde o código em lugar seguro. Quem tiver ele mexe no seu funil.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!code.trim()}
                onClick={() => {
                  enableSync(code);
                  setOpen(false);
                  setCode("");
                }}
                className="flex-1 rounded-full bg-taxi px-4 py-2.5 text-sm font-semibold text-ink transition-opacity disabled:opacity-40"
              >
                Ativar neste aparelho
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
