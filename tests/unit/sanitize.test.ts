import { describe, expect, it } from "vitest";
import { sanitizeNext } from "@/lib/sanitize";

describe("sanitizeNext", () => {
  it("test_sanitize_next_interno_valido", () => {
    expect(sanitizeNext("/dashboard")).toBe("/dashboard");
    expect(sanitizeNext("/?next=/perfil")).toBe("/?next=/perfil");
  });

  it("test_sanitize_next_externo_rejeitado", () => {
    expect(sanitizeNext("https://evil.com")).toBeNull();
    expect(sanitizeNext("//evil.com")).toBeNull();
    expect(sanitizeNext("/\\evil.com")).toBeNull();
    expect(sanitizeNext("\\\\evil.com")).toBeNull();
  });

  it("test_sanitize_next_vazio_nulo", () => {
    expect(sanitizeNext(null)).toBeNull();
    expect(sanitizeNext(undefined)).toBeNull();
    expect(sanitizeNext("")).toBeNull();
  });
});
