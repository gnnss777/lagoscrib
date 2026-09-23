import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { apartments, saleApartments } from "@/lib/data";

// S002: trava de regressão da galeria (AC1: ≥ 8 fotos válidas por imóvel).
// Roda em node: confere que cada src de photos[] existe em public/.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("galeria", () => {
  const todos = [...apartments, ...saleApartments];

  it("test_galeria_originais_11_fotos_novos_minimo_1", () => {
    expect(todos).toHaveLength(109);
    const originais = new Set([
      "zap-aguaverde-castro-123",
      "zap-aguaverde-raul-90",
      "zap-ahu-eca-78",
      "zap-centro-comendador-130",
      "zap-centro-bufren-96",
      "zap-juveve-goulin-66",
      "zap-cabral-manoel-104",
      "zap-bacacheri-parana-107",
      "zap-tingui-brasilio-71",
      "zap-aguaverde-iguacu-140",
      "zap-capaoraso-churchill-78",
      "zap-ecoville-rosa-87",
    ]);
    for (const a of todos) {
      // capa (photos[0] = image, compat); originais têm 11, novos ≥ 1
      const piso = originais.has(a.id) ? 11 : 1;
      expect(a.photos?.length, `${a.id} fotos`).toBeGreaterThanOrEqual(piso);
      if (originais.has(a.id)) {
        expect(a.photos?.length, `${a.id} fotos`).toBe(11);
      }
      expect(a.photos?.[0].src, `${a.id} photos[0]`).toBe(a.image);
    }
  });

  it("test_galeria_todos_arquivos_existem_em_public", () => {
    const ausentes: string[] = [];
    for (const a of todos) {
      for (const p of a.photos ?? []) {
        const disk = join("public", p.src);
        if (!existsSync(disk)) ausentes.push(`${a.id}:${p.src}`);
      }
    }
    expect(ausentes, "arquivos ausentes").toEqual([]);
  });
});
