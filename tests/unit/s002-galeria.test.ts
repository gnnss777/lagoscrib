import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { apartments, saleApartments } from "@/lib/data";

// Trava de regressão da galeria (S002, AC1: >= 8 fotos válidas por imóvel).
// Roda em node: confere que cada src de photos[] existe em public/.
// A contagem de imóveis fica em s001-data.test.ts — aqui o que importa é a
// integridade das fotos. Convenção do estúdio:
// test_[sistema]_[cenário]_[resultado_esperado].
describe("galeria", () => {
  const todos = [...apartments, ...saleApartments];

  it("test_galeria_minimo_8_fotos_com_capa_no_indice_zero", () => {
    for (const a of todos) {
      expect(a.photos?.length, `${a.id} fotos`).toBeGreaterThanOrEqual(8);
      // photos[0] é a capa: compat com o campo image.
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
