import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_STATE_KEY,
  applySnapshot,
  buildSnapshot,
  emptySnapshot,
  reconcileOnLoad,
  samePayload,
  snapshotSchema,
  type OwnerSnapshot,
} from "@/lib/ownerState";
import { REMOVED_IDS_STORAGE_VERSION } from "@/lib/constants";

/**
 * O sync inteiro depende destas funções puras: o que entra no documento, o que
 * fica de fora, e quem ganha quando dois aparelhos mexem ao mesmo tempo. As
 * rotas e o Redis são só wiring; a decisão mora aqui.
 *
 * O vitest roda em `environment: "node"` e o projeto não tem jsdom. Um
 * localStorage em memória resolve — adicionar jsdom por três testes seria uma
 * dependência a mais por causa de um objeto de seis linhas.
 */
function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeLocalStorage());
});

function snap(over: Partial<OwnerSnapshot> = {}): OwnerSnapshot {
  return { ...emptySnapshot(), ...over };
}

describe("owner state", () => {
  it("test_ownerstate_snapshot_vazio_nao_quebra", () => {
    const s = emptySnapshot();
    expect(s.v).toBe(1);
    expect(s.removedIds).toEqual([]);
    expect(snapshotSchema.safeParse(s).success).toBe(true);
  });

  it("test_ownerstate_nao_sincroniza_sessao", () => {
    // isAuthenticated/username são estado de sessão: se fossem no documento,
    // o "Sair" de um aparelho jogaria o outro para a tela de login.
    const s = snap();
    expect(Object.keys(s)).not.toContain("isAuthenticated");
    expect(Object.keys(s)).not.toContain("username");
  });

  it("test_ownerstate_rejeita_status_fora_do_enum", () => {
    const base = snap();
    const bad = {
      ...base,
      statuses: [
        { apartmentId: "x", status: "status-que-nao-existe", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
    };
    expect(snapshotSchema.safeParse(bad).success).toBe(false);
    const good = {
      ...base,
      statuses: [{ apartmentId: "x", status: "contactado", updatedAt: "2026-01-01T00:00:00.000Z" }],
    };
    expect(snapshotSchema.safeParse(good).success).toBe(true);
  });

  it("test_ownerstate_rejeita_snapshot_de_versao_futura", () => {
    // Documento gravado por versão futura não pode ser sobrescrito nem
    // interpretado: o schema é o portão.
    expect(snapshotSchema.safeParse({ ...emptySnapshot(), v: 2 }).success).toBe(false);
  });

  it("test_ownerstate_reconcile_adota_remoto_mais_novo", () => {
    const local = snap({ updatedAt: "2026-09-28T10:00:00.000Z", removedIds: ["a"] });
    const remote = snap({ updatedAt: "2026-09-28T11:00:00.000Z", removedIds: ["a", "b"] });
    const r = reconcileOnLoad(local, remote);
    expect(r.adoptedRemote).toBe(true);
    expect(r.snapshot.removedIds).toEqual(["a", "b"]);
  });

  it("test_ownerstate_reconcile_adota_remoto_mesmo_com_relogio_local_mais_novo", () => {
    // O bug real: `updatedAt` é carimbado pelo CLIENTE, então um aparelho
    // recém-aberto sempre parece o mais novo e subia o estado vazio por cima do
    // dono. A carga é sempre leitura, independentemente do relógio local.
    const local = snap({ updatedAt: "2026-09-28T23:59:59.000Z", removedIds: [] });
    const remote = snap({ updatedAt: "2026-09-28T10:00:00.000Z", removedIds: ["do-dono"] });
    const r = reconcileOnLoad(local, remote);
    expect(r.adoptedRemote).toBe(true);
    expect(r.snapshot.removedIds).toEqual(["do-dono"]);
  });

  it("test_ownerstate_reconcile_sem_remoto_mantem_local", () => {
    const local = snap({ updatedAt: "2026-09-28T10:00:00.000Z", removedIds: ["a"] });
    const r = reconcileOnLoad(local, null);
    expect(r.adoptedRemote).toBe(false);
    expect(r.snapshot.removedIds).toEqual(["a"]);
  });

  it("test_ownerstate_apply_escreve_a_versao_que_o_leitor_aceita", () => {
    // Regressão real: applySnapshot gravava `version: 1` fixo enquanto o leitor
    // em lib/pool.ts exige REMOVED_IDS_STORAGE_VERSION (2). O excluído chegava
    // ao navegador e era descartado na leitura. Este teste pega a regressão
    // mesmo que a constante mude de novo.
    localStorage.clear();
    applySnapshot(snap({ removedIds: ["apolar-x"] }));
    const gravado = JSON.parse(
      localStorage.getItem("apartamentos-app-removed") ?? "{}",
    ) as { version?: number; ids?: string[] };
    expect(gravado.version).toBe(REMOVED_IDS_STORAGE_VERSION);
    expect(gravado.ids).toEqual(["apolar-x"]);
  });

  it("test_ownerstate_apply_escreve_as_tres_chaves", () => {
    localStorage.clear();
    applySnapshot(
      snap({
        removedIds: ["apolar-x"],
        notes: [{ id: "n1", apartmentId: "a", text: "oi", createdAt: "2026-01-01" }],
        checklist: { a: ["pressao"] },
        followUps: { a: { attempts: 2, status: "aguardando" } },
      }),
    );
    expect(JSON.parse(localStorage.getItem(APP_STATE_KEY) ?? "{}").notes).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("apartamentos-app-removed") ?? "{}").ids).toEqual([
      "apolar-x",
    ]);
  });

  it("test_ownerstate_build_lê_o_localstorage", () => {
    localStorage.clear();
    localStorage.setItem(
      APP_STATE_KEY,
      JSON.stringify({ statuses: [{ apartmentId: "a", status: "novo", updatedAt: "2026-01-01" }] }),
    );
    localStorage.setItem("apartamentos-app-removed", JSON.stringify({ version: 1, ids: ["b"] }));
    const s = buildSnapshot();
    expect(s.removedIds).toEqual(["b"]);
    expect(s.statuses[0]?.apartmentId).toBe("a");
    // O que não existe no storage entra como lista vazia, nunca undefined.
    expect(s.notes).toEqual([]);
    expect(s.userAdded).toEqual([]);
  });

  it("test_ownerstate_build_ignora_json_corrompido", () => {
    localStorage.clear();
    localStorage.setItem(APP_STATE_KEY, "{quebrado");
    const s = buildSnapshot();
    expect(s.notes).toEqual([]);
    expect(s.statuses).toEqual([]);
  });

  it("test_ownerstate_samepayload_ignora_updatedat", () => {
    // Bug real pego pelo teste de dois PCs: um aparelho que só abre o app
    // montava um snapshot igual ao que acabou de puxar e empurrava, apagando o
    // que o dono mexeu no outro (last-write-wins). samePayload é o que cancela.
    const a = snap({ updatedAt: "2026-09-28T10:00:00.000Z", removedIds: ["x"] });
    const b = snap({ updatedAt: "2026-09-28T11:00:00.000Z", removedIds: ["x"] });
    expect(samePayload(a, b)).toBe(true);
    expect(samePayload(a, snap({ updatedAt: a.updatedAt, removedIds: ["y"] }))).toBe(false);
    expect(samePayload(null, b)).toBe(false);
  });

  it("test_ownerstate_token_ausente_nao_quebra", () => {    // localStorage indisponível (SSR, modo privado sem storage) não pode
    // derrubar o app: tudo vira "" e o sync fica desligado.
    vi.stubGlobal("localStorage", undefined);
    // Sem localStorage o app não quebra e não há estado para montar — é o
    // comportamento de quem abriu sem-storage. O token de sync foi removido
    // (a credencial agora é o cookie de sessão), então não há mais nada a
    // gravar aqui.
    expect(buildSnapshot().removedIds).toEqual([]);
  });
});
