import { describe, expect, it } from "vitest";
import {
  buildPhotoAlt,
  buildPhotoCounter,
  cycleZoomLevel,
  getGalleryPhotos,
  nextPhotoIndex,
  prevPhotoIndex,
} from "@/lib/gallery";

// TDD S003 (RED→GREEN): núcleo puro de navegação da galeria.
// UI (zoom/pan/swipe) vai para o Playwright — aqui só índice, wrap,
// contador e legenda/alt (nunca inventar cômodo: alt é posicional).
// Convenção do estúdio: test_[sistema]_[cenário]_[resultado_esperado].
describe("gallery", () => {
  it("test_galeria_fotos_existentes_retorna_lista", () => {
    const photos = getGalleryPhotos({
      image: "/imoveis/capa.webp",
      photos: [{ src: "/imoveis/capa.webp" }, { src: "/imoveis/a/01.webp" }],
    });
    expect(photos).toHaveLength(2);
  });

  it("test_galeria_sem_photos_fallback_capa", () => {
    const photos = getGalleryPhotos({ image: "/imoveis/capa.webp" });
    expect(photos).toEqual([{ src: "/imoveis/capa.webp" }]);
  });

  it("test_galeria_proximo_indice_avanca", () => {
    expect(nextPhotoIndex(0, 11)).toBe(1);
  });

  it("test_galeria_proximo_no_fim_volta_ao_inicio", () => {
    expect(nextPhotoIndex(10, 11)).toBe(0);
  });

  it("test_galeria_anterior_no_inicio_vai_ao_fim", () => {
    expect(prevPhotoIndex(0, 11)).toBe(10);
  });

  it("test_galeria_anterior_indice_meio_recua", () => {
    expect(prevPhotoIndex(5, 11)).toBe(4);
  });

  it("test_galeria_contador_primeira_foto_formata", () => {
    expect(buildPhotoCounter(0, 11)).toBe("1/11");
  });

  it("test_galeria_contador_ultima_foto_formata", () => {
    expect(buildPhotoCounter(10, 11)).toBe("11/11");
  });

  it("test_galeria_alt_posicional_sem_inventar_comodo", () => {
    expect(buildPhotoAlt("Apartamento - Água Verde", 0, 11)).toBe(
      "Apartamento - Água Verde — foto 1 de 11"
    );
  });

  it("test_galeria_zoom_cicla_1x_2x_4x", () => {
    expect(cycleZoomLevel(1)).toBe(2);
    expect(cycleZoomLevel(2)).toBe(4);
    expect(cycleZoomLevel(4)).toBe(1);
  });
});
