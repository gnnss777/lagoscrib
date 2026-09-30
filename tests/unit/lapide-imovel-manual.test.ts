// Lapide do imovel cadastrado a mao: a exclusao tem de sobreviver ao sync.
//
// `userAdded` e UNIAO no merge (o servidor nao pode apagar o que so existe num
// aparelho). Sem uma lapide propria, a exclusao nao viajava: o dono exclui no
// PC1, o `userAdded` continua la, e o PC2 traz o imovel de volta no proximo
// pull. A lapide mora em `apartamentos-app-new-removed`, e NAO em
// `apartamentos-app-removed` — a lista de removidos da base, que o teste
// `test_delete_new_remove_fisico_sem_removed_ids` exige que fique nula.
import { describe, expect, it } from "vitest";
import {
  emptySnapshot,
  reconcileOnLoad,
  snapshotSchema,
  type OwnerSnapshot,
} from "@/lib/ownerState";

const imovel = (id: string) => ({ id, title: `Imovel ${id}`, rent: 2500 });
const snap = (patch: Partial<OwnerSnapshot> = {}): OwnerSnapshot => ({
  ...emptySnapshot(new Date("2026-09-28T10:00:00.000Z")),
  ...patch,
});

describe("lapide de imovel cadastrado a mao", () => {
  it("test_exclusao_no_pc1_nao_deixa_o_imovel_voltar_no_pc2", () => {
    // PC1 excluiu: o userAdded local ja nao tem o imovel, e a lapide diz que
    // ele morreu.
    const pc1 = snap({
      userAdded: [imovel("new-b"), imovel("new-c")],
      deletedUserAdded: ["new-a"],
    });
    // PC2 ainda tem o imovel e nunca viu a exclusao.
    const pc2 = snap({ userAdded: [imovel("new-a"), imovel("new-b")] });

    const r = reconcileOnLoad(pc2, pc1);

    const ids = r.snapshot.userAdded.map((u) => (u as { id: string }).id);
    expect(ids).not.toContain("new-a"); // a lapide do remoto venceu
    expect(ids).toEqual(expect.arrayContaining(["new-b", "new-c"]));
    expect(r.snapshot.deletedUserAdded).toContain("new-a");
  });

  it("test_lapide_so_apaga_o_que_ela_nomeia", () => {
    const local = snap({ userAdded: [imovel("new-a"), imovel("new-b")] });
    const remoto = snap({ deletedUserAdded: ["new-a"] });
    const ids = reconcileOnLoad(local, remoto).snapshot.userAdded.map(
      (u) => (u as { id: string }).id,
    );
    expect(ids).toEqual(["new-b"]);
  });

  it("test_lapide_com_versao_antiga_do_schema_nao_derruba_o_documento", () => {
    // Documento gravado antes desta versao nao tem a chave. Se fosse campo
    // obrigatorio, o parse reprovaria o documento INTEIRO e o GET devolveria
    // data: null — o aparelho subiria o estado vazio por cima do dono.
    const antigo = { ...snap({ userAdded: [imovel("new-a")] }) } as Record<
      string,
      unknown
    >;
    delete antigo.deletedUserAdded;

    const p = snapshotSchema.safeParse(antigo);
    expect(p.success).toBe(true);
    if (p.success) expect(p.data.deletedUserAdded).toEqual([]);
  });

  it("test_aparelho_novo_continua_adotando_o_documento_inteiro", () => {
    // Local vazio tem que virar o remoto: senao quem abre o site no celular ve
    // o funil vazio.
    const remoto = snap({
      userAdded: [imovel("new-x")],
      deletedUserAdded: ["new-y"],
      statuses: [
        {
          apartmentId: "imovel-a",
          status: "visita",
          updatedAt: "2026-09-28T10:00:00.000Z",
        },
      ],
    });
    const r = reconcileOnLoad(emptySnapshot(), remoto);
    expect(r.snapshot).toEqual(remoto);
  });

  it("test_lapide_da_base_e_a_da_propriedade_continuam_independentes", () => {
    // Remover da base e remover um imovel manual sao coisas distintas. Um id
    // excluido da base nao pode varrer o userAdded, e vice-versa.
    const local = snap({ userAdded: [imovel("new-a")], removedIds: ["zap-1"] });
    const remoto = snap({ removedIds: ["zap-2"] });
    const r = reconcileOnLoad(local, remoto);
    expect(r.snapshot.removedIds).toEqual(expect.arrayContaining(["zap-1", "zap-2"]));
    expect((r.snapshot.userAdded[0] as { id: string }).id).toBe("new-a");
  });
});
