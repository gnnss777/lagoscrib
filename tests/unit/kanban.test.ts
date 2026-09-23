import { describe, expect, it } from "vitest";
import {
  KANBAN_COLUMNS,
  DEFAULT_COLUMN_CONFIG,
  buildColumns,
  moveCard,
  markContactFollowUp,
  markReturnedFollowUp,
  countHanging,
  isHanging,
  migrateStoredState,
  parseColumnConfig,
  toSyncFollowUps,
  type ApartmentStatus,
  type FollowUp,
  type StoredState,
} from "@/lib/kanban";
import { syncPushSchema } from "@/lib/validation";

// Kanban de prospecção — núcleo puro (lib/kanban.ts).
// UI nunca é dona do estado: componentes só chamam estas funções.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
const NOW = "2026-09-23T12:00:00.000Z";

function status(
  apartmentId: string,
  s: ApartmentStatus["status"],
  index = 0,
): ApartmentStatus {
  return { apartmentId, status: s, updatedAt: NOW, index };
}

describe("kanban núcleo", () => {
  it("test_kanban_mover_entre_colunas_ordem_preservada", () => {
    // arrange: coluna feita com [a(0), b(1)], agendado vazio
    const prev = [status("a", "feita", 0), status("b", "feita", 1)];

    // act: move b para agendado posição 0
    const next = moveCard(prev, "b", "agendado", 0);

    // assert: feita só tem a (reindex 0); agendado tem b (index 0)
    expect(next.find((s) => s.apartmentId === "a")).toMatchObject({
      status: "feita",
      index: 0,
    });
    expect(next.find((s) => s.apartmentId === "b")).toMatchObject({
      status: "agendado",
      index: 0,
    });
  });

  it("test_kanban_mover_para_fim_sem_indice", () => {
    // arrange/act: move card novo (sem entrada) para negociacao sem toIndex
    const next = moveCard([], "x", "negociacao");

    // assert: entra no fim (index 0, única entrada)
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ status: "negociacao", index: 0 });
  });

  it("test_kanban_imutabilidade_estado_original_intacto", () => {
    // arrange
    const prev = [status("a", "novo", 0)];
    const snapshot = JSON.parse(JSON.stringify(prev));

    // act
    moveCard(prev, "a", "feita", 0);

    // assert: entrada original intacta
    expect(prev).toEqual(snapshot);
  });

  it("test_kanban_followup_contador_incrementa_ate_retornou", () => {
    // arrange: sem follow-up
    let fu: Record<string, FollowUp> = {};

    // act: dois contatos
    fu = markContactFollowUp(fu, "a", NOW);
    fu = markContactFollowUp(fu, "a", NOW);

    // assert
    expect(fu["a"]).toMatchObject({ attempts: 2, status: "aguardando" });

    // act: retornou
    fu = markReturnedFollowUp(fu, "a");

    // assert: contato posterior NÃO reabre a contagem
    fu = markContactFollowUp(fu, "a", NOW);
    expect(fu["a"]).toMatchObject({ attempts: 2, status: "retornou" });
  });

  it("test_kanban_followup_retornou_preserva_historico_contato", () => {
    // arrange: 3 tentativas com data
    let fu: Record<string, FollowUp> = {};
    fu = markContactFollowUp(fu, "a", "2026-09-20T10:00:00.000Z");
    fu = markContactFollowUp(fu, "a", "2026-09-21T10:00:00.000Z");
    fu = markContactFollowUp(fu, "a", "2026-09-22T10:00:00.000Z");

    // act
    fu = markReturnedFollowUp(fu, "a");

    // assert: histórico preservado
    expect(fu["a"]).toMatchObject({
      attempts: 3,
      status: "retornou",
      lastContactAt: "2026-09-22T10:00:00.000Z",
    });
  });

  it("test_kanban_coluna_alerta_sem_retorno_7dias", () => {
    // arrange: um pendente há 8 dias, um há 2 dias, um retornado
    const fu: Record<string, FollowUp> = {
      velho: {
        attempts: 2,
        status: "aguardando",
        lastContactAt: "2026-09-15T12:00:00.000Z",
      },
      novo: {
        attempts: 1,
        status: "aguardando",
        lastContactAt: "2026-09-21T12:00:00.000Z",
      },
      ok: { attempts: 3, status: "retornou", lastContactAt: NOW },
    };

    // act/assert: limiar 7 dias conta só o velho
    expect(isHanging(fu["velho"], 7, NOW)).toBe(true);
    expect(isHanging(fu["novo"], 7, NOW)).toBe(false);
    expect(isHanging(fu["ok"], 7, NOW)).toBe(false);
    expect(countHanging(fu, 7, NOW)).toBe(1);
  });

  it("test_kanban_persistencia_v3_defaults_estados_v1v2", () => {
    // arrange: estado v1 (sem version/checklist/followUps)
    const v1 = {
      isAuthenticated: true,
      username: "guinness",
      notes: [],
      statuses: [status("a", "agendado")],
    };

    // act
    const migrated = migrateStoredState(v1);

    // assert: ganha defaults sem perder nada
    expect(migrated.followUps).toEqual({});
    expect(migrated.checklist).toEqual({});
    expect(migrated.statuses).toHaveLength(1);
    expect(migrated.version).toBe(3);
  });

  it("test_kanban_scheduledDate_preservado_ao_trocar_status", () => {
    // arrange (regressão B1): visita agendada com data
    const prev = [
      { ...status("a", "agendado", 0), scheduledDate: "2026-09-25" },
    ];

    // act: feita sem passar data → preserva; volta a agendado → ainda lá
    const feita = moveCard(prev, "a", "feita");
    expect(feita[0].scheduledDate).toBe("2026-09-25");
    const deVolta = moveCard(feita, "a", "agendado", 0);
    expect(deVolta[0].scheduledDate).toBe("2026-09-25");

    // act: limpeza explícita → some
    const limpo = moveCard(deVolta, "a", "agendado", 0, { clearDate: true });
    expect(limpo[0].scheduledDate).toBeUndefined();
  });

  it("test_kanban_contrato_sync_push_followups_zod_ok", () => {
    // arrange: estado v3 serializado no formato do sync (B3/B4)
    const fu: Record<string, FollowUp> = {
      a: { attempts: 2, status: "aguardando", lastContactAt: NOW },
      b: { attempts: 1, status: "retornou" },
    };

    // act
    const payload = { statuses: [], notes: [], followUps: toSyncFollowUps(fu) };

    // assert: backend aceita 100% (zod não reclama)
    expect(() => syncPushSchema.parse(payload)).not.toThrow();
    const parsed = syncPushSchema.parse(payload);
    expect(parsed.followUps).toHaveLength(2);
  });

  it("test_kanban_pull_mapping_followup_parse_ok", () => {
    // arrange: JSON que GET /api/sync/pull retorna hoje
    const pull = {
      externalId: "zap-x",
      portal: "zap",
      urlOriginal: "https://www.zapimoveis.com.br/imovel/x/",
      status: "negociacao",
      updatedAt: NOW,
      followUp: { attempts: 2, status: "aguardando", lastContactAt: NOW },
      notes: [],
    };

    // act: valida contra o contrato de entrada do follow-up
    const parsed = syncPushSchema.parse({
      statuses: [],
      notes: [],
      followUps: [
        {
          apartmentId: pull.externalId,
          portal: pull.portal,
          urlOriginal: pull.urlOriginal,
          ...pull.followUp,
        },
      ],
    });

    // assert
    expect(parsed.followUps[0]).toMatchObject({ attempts: 2 });
  });

  it("test_kanban_colunas_customizadas_reload_preserva_reset_default", () => {
    // arrange: config customizada serializada (reload = parse do JSON)
    const raw = JSON.stringify({
      version: 1,
      order: ["feita", "novo"],
      hidden: ["recusado"],
      labels: { novo: "Quero visitar" },
    });

    // act
    const cfg = parseColumnConfig(raw);

    // assert: sobrevive ao reload
    expect(cfg.order).toEqual(["feita", "novo"]);
    expect(cfg.hidden).toEqual(["recusado"]);
    expect(cfg.labels["novo"]).toBe("Quero visitar");

    // act: lixo volta ao default exato (6 colunas, sem hidden)
    expect(parseColumnConfig("lixo{{{")).toEqual(DEFAULT_COLUMN_CONFIG);

    // assert: default tem as 6 colunas na ordem do pipeline
    expect(KANBAN_COLUMNS).toEqual([
      "novo",
      "agendado",
      "feita",
      "negociacao",
      "aprovado",
      "recusado",
    ]);
  });

  it("test_kanban_buildColumns_agrupa_e_ordena", () => {
    // arrange
    const statuses = [
      status("b", "novo", 1),
      status("a", "novo", 0),
      status("c", "feita", 0),
    ];

    // act
    const cols = buildColumns(statuses, {}, DEFAULT_COLUMN_CONFIG);

    // assert: agrupa por status e ordena por index
    expect(cols.find((c) => c.status === "novo")?.ids).toEqual(["a", "b"]);
    expect(cols.find((c) => c.status === "feita")?.ids).toEqual(["c"]);
    expect(cols).toHaveLength(6);
  });

  it("test_kanban_migrateStoredState_estado_inexistente_vazio", () => {
    // arrange/act: nada salvo (null) → defaults limpos
    const s: StoredState = migrateStoredState(null);

    // assert
    expect(s).toMatchObject({
      version: 3,
      statuses: [],
      checklist: {},
      followUps: {},
    });
  });
});
