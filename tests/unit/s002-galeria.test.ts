import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { apartments, saleApartments } from "@/lib/data";

// S002: trava de regressão da galeria (AC1: ≥ 8 fotos válidas por imóvel).
// Roda em node: confere que cada src de photos[] existe em public/.
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("galeria", () => {
  const todos = [...apartments, ...saleApartments];

  it("test_galeria_todos_imoveis_com_11_fotos", () => {
    expect(todos).toHaveLength(12);
    for (const a of todos) {
      // capa (photos[0] = image, compat) + 10 da galeria
      expect(a.photos?.length, `${a.id} fotos`).toBe(11);
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
