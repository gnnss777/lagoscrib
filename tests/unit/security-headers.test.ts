import { describe, expect, it } from "vitest";
import { applySecurityHeaders, buildCsp } from "@/lib/security-headers";

describe("security headers", () => {
  it("test_security_headers_csp_nonce_obrigatorio", () => {
    const csp = buildCsp("abc-123");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'nonce-abc-123'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("test_security_headers_aplicados_coop_corp_noindex", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, "nonce-x");
    expect(headers.get("Content-Security-Policy")).toContain("'nonce-nonce-x'");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});
