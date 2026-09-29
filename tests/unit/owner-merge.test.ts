// Rede de segurança do merge: estado vazio nao pode vencer estado com coisa.
import { describe, expect, it } from "vitest";
import { reconcileOnLoad, emptySnapshot, type OwnerSnapshot } from "@/lib/ownerState";

const comDado = (): OwnerSnapshot => ({
  ...emptySnapshot(new Date("2026-09-28T10:00:00.000Z")),
  statuses: [
    {
      apartmentId: "imovel-a",
      status: "visita",
      updatedAt: "2026-09-28T10:00:00.000Z",
    },
  ],
});

describe("reconcileOnLoad — aba anonima nao pode apagar o dono", () => {
  it("test_reconcile_local_com_dado_nao_adota_servidor_vazio", () => {
    // A falha real: aba anônima sem localStorage empurra o vazio, o dono abre
    // o app e o reconcile antigo adotava o vazio — kanban sumia.
    const r = reconcileOnLoad(comDado(), emptySnapshot());
    expect(r.adoptedRemote).toBe(false);
    expect(r.snapshot.statuses).toHaveLength(1);
  });

  it("test_reconcile_local_vazio_adota_servidor_com_dado", () => {
    // Aparelho novo: o servidor é o acumulado, então o remoto vence.
    const r = reconcileOnLoad(emptySnapshot(), comDado());
    expect(r.adoptedRemote).toBe(true);
    expect(r.snapshot.statuses).toHaveLength(1);
  });

  it("test_reconcile_dos_vazios_nao_importa_quem_veneu", () => {
    const local = emptySnapshot(new Date("2026-09-28T09:00:00.000Z"));
    const remote = emptySnapshot(new Date("2026-09-28T10:00:00.000Z"));
    const r = reconcileOnLoad(local, remote);
    expect(r.snapshot.removedIds).toEqual([]);
    expect(r.snapshot.statuses).toEqual([]);
  });

  it("test_reconcile_servidor_null_sobe_o_local", () => {
    const r = reconcileOnLoad(comDado(), null);
    expect(r.adoptedRemote).toBe(false);
    expect(r.snapshot.statuses).toHaveLength(1);
  });

  it("test_reconcile_remoto_com_dado_manda_mesmo_com_local_vazio", () => {
    const remoto = comDado();
    remoto.notes = [
      {
        id: "nota-1",
        apartmentId: "imovel-b",
        text: "anotacao",
        createdAt: "2026-09-28T10:00:00.000Z",
      },
    ];
    const r = reconcileOnLoad(emptySnapshot(), remoto);
    expect(r.adoptedRemote).toBe(true);
    expect(r.snapshot.notes).toHaveLength(1);
  });
});
