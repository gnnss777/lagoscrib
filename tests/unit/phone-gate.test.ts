import { describe, expect, it } from "vitest";
import { isBusinessHours, maskPhone } from "@/lib/phone-gate";

// Horário comercial padrão: seg–sex 09:00–18:00 America/Sao_Paulo.
// Datas fixas em UTC convertidas: SP = UTC-3 (sem DST desde 2019).

describe("phone gate", () => {
  it("test_phone_gate_horario_comercial_exibe", () => {
    // Quarta-feira 14:00 SP = 17:00 UTC.
    expect(isBusinessHours(new Date("2026-09-23T17:00:00Z"))).toBe(true);
  });

  it("test_phone_gate_fora_horario_somente_link", () => {
    // Quarta-feira 20:00 SP = 23:00 UTC.
    expect(isBusinessHours(new Date("2026-09-23T23:00:00Z"))).toBe(false);
    // Sábado 12:00 SP = 15:00 UTC.
    expect(isBusinessHours(new Date("2026-09-26T15:00:00Z"))).toBe(false);
    // Domingo 12:00 SP = 15:00 UTC.
    expect(isBusinessHours(new Date("2026-09-27T15:00:00Z"))).toBe(false);
  });

  it("test_phone_gate_bordas_9h_18h", () => {
    // 09:00 SP em ponto abre; 18:00 SP em ponto fecha.
    expect(isBusinessHours(new Date("2026-09-23T12:00:00Z"))).toBe(true);
    expect(isBusinessHours(new Date("2026-09-23T21:00:00Z"))).toBe(false);
  });

  it("test_phone_gate_mascara_nunca_expoe_completo", () => {
    const masked = maskPhone("+55 (41) 99850-1542");
    expect(masked).not.toContain("98501542");
    expect(masked).toContain("42");
    expect(maskPhone("abc")).toBe("(**) *****-****");
  });
});
