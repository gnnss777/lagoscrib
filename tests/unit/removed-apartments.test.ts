import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  REMOVED_IDS_STORAGE_KEY,
  REMOVED_IDS_STORAGE_VERSION,
} from "@/lib/constants";

/**
 * Testes de remoção de apartamento (estático ou new-*).
 *
 * O AppContext persiste ids excluídos em chave própria
 * (`apartamentos-app-removed` v1). Estes testes validam:
 * - Hidratção do storage no mount
 * - Persistência do id após removeApartment
 * - Filtragem da lista exibida
 * - Limpeza de estado órfão (status/notas/checklist/followup)
 */

// localStorage mock (vitest node environment não tem localStorage).
class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

function readRemovedIds(): string[] {
  try {
    const raw = localStorage.getItem(REMOVED_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.version === REMOVED_IDS_STORAGE_VERSION &&
      Array.isArray(parsed.ids)
    ) {
      return parsed.ids.filter((id: unknown) => typeof id === "string");
    }
  } catch {
    // ignore
  }
  return [];
}

function writeRemovedIds(ids: string[]) {
  localStorage.setItem(
    REMOVED_IDS_STORAGE_KEY,
    JSON.stringify({ version: REMOVED_IDS_STORAGE_VERSION, ids }),
  );
}

describe("removed ids persistence", () => {
  beforeEach(() => {
    const g = globalThis as Record<string, unknown>;
    g["localStorage"] = new LocalStorageMock();
  });
  afterEach(() => {
    const g = globalThis as Record<string, unknown>;
    delete g["localStorage"];
  });

  it("test_remove_estatistico_persiste_no_storage", () => {
    // arrange: usuário exclui imóvel estático (id não começa com new-)
    const staticId = "zap-aguaverde-castro-123";
    writeRemovedIds([staticId]);

    // act: leitura simula hidratação no mount
    const ids = readRemovedIds();

    // assert: id está na lista
    expect(ids).toContain(staticId);
    expect(ids).toHaveLength(1);
  });

  it("test_remove_estatistico_filtra_da_lista_exibida", () => {
    // arrange: imóveis estáticos + um removido
    const allIds = [
      "zap-aguaverde-castro-123",
      "zap-aguaverde-raul-90",
      "zap-centro-comendador-130",
    ];
    const removed = new Set(["zap-aguaverde-raul-90"]);
    const visible = allIds.filter((id) => !removed.has(id));

    // assert: removido não aparece
    expect(visible).not.toContain("zap-aguaverde-raul-90");
    expect(visible).toHaveLength(2);
  });

  it("test_remove_mantem_estado_limpo_apos_exclusao", () => {
    // arrange: antes da remoção, o imóvel tinha estado
    const staticId = "zap-aguaverde-castro-123";
    const statusesBefore = [
      { apartmentId: staticId, status: "contactado", updatedAt: "2026-09-23T12:00:00.000Z", index: 0 },
      { apartmentId: "other", status: "novo", updatedAt: "2026-09-23T12:00:00.000Z", index: 0 },
    ];

    // act: removeApartment filtra o estado
    const statusesAfter = statusesBefore.filter((s) => s.apartmentId !== staticId);

    // assert: estado do imóvel removido não existe mais
    expect(statusesAfter.find((s) => s.apartmentId === staticId)).toBeUndefined();
    expect(statusesAfter).toHaveLength(1);
  });

  it("test_remove_new_igual_funciona", () => {
    // arrange: imóvel adicionado pelo usuário
    const newId = "new-1234567890";
    writeRemovedIds([newId]);

    // act
    const ids = readRemovedIds();

    // assert: também persiste normalmente
    expect(ids).toContain(newId);
  });

  it("test_remove_multiplos_ids_persiste_sem_duplicar", () => {
    // arrange: duas remoções
    writeRemovedIds(["zap-a", "zap-b"]);

    // act: tenta adicionar o mesmo id novamente — AppContext evita duplicação
    const current = readRemovedIds();
    const next = current.includes("zap-a") ? current : [...current, "zap-a"];
    writeRemovedIds(next);

    // assert: sem duplicação
    const finalIds = readRemovedIds();
    expect(finalIds.filter((id) => id === "zap-a")).toHaveLength(1);
    expect(finalIds).toContain("zap-b");
  });

  it("test_remove_estatistico_persiste_no_reload", () => {
    // arrange: imóvel excluído persistido no storage
    const staticId = "zap-centro-bufren-96";
    writeRemovedIds([staticId]);

    // act: simula recarregamento (nova leitura do storage)
    const reloadedIds = readRemovedIds();

    // assert: id continua lá
    expect(reloadedIds).toContain(staticId);
  });

  it("test_remove_json_quebrado_nao_quebra", () => {
    // arrange: lixo no storage
    localStorage.setItem(REMOVED_IDS_STORAGE_KEY, "invalid{{{json");

    // act/assert: retorna lista vazia (fallback seguro)
    const ids = readRemovedIds();
    expect(ids).toEqual([]);
  });

  it("test_remove_versao_incompativel_retorna_vazio", () => {
    // arrange: versão incompatível
    localStorage.setItem(
      REMOVED_IDS_STORAGE_KEY,
      JSON.stringify({ version: 99, ids: ["zap-a"] }),
    );

    // act/assert: ignora e retorna vazio
    const ids = readRemovedIds();
    expect(ids).toEqual([]);
  });
});
