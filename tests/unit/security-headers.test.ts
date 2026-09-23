import { describe, expect, it } from "vitest";
import { applySecurityHeaders, buildCsp } from "@/lib/security-headers";

describe("security headers", () => {
  it("test_security_headers_csp_permite_inline_scripts_next", () => {
    const csp = buildCsp("abc-123");
    expect(csp).toContain("default-src 'self'");
    // Home é estática (sem SSR-nonce): script-src precisa aceitar inline,
    // senão a hidratação do Next quebra (página em branco, React #412).
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'nonce-");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("test_security_headers_aplicados_coop_corp_noindex", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, "nonce-x");
    expect(headers.get("Content-Security-Policy")).toContain("script-src 'self' 'unsafe-inline'");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});
