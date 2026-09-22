import { describe, expect, it, beforeEach } from "vitest";
import {
  checkLoginAttempt,
  clearAllLoginAttempts,
  clearLoginAttempts,
  recordLoginFailure,
} from "@/lib/login-throttle";

describe("login throttle", () => {
  beforeEach(() => {
    clearAllLoginAttempts();
  });

  it("test_login_throttle_bloqueia_apos_5_falhas", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure("1.2.3.4", "a@b.com");
    const attempt = checkLoginAttempt("1.2.3.4", "a@b.com");
    expect(attempt.allowed).toBe(false);
    expect(attempt.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("test_login_throttle_sucesso_limpa_contador", () => {
    for (let i = 0; i < 4; i++) recordLoginFailure("1.2.3.4", "a@b.com");
    clearLoginAttempts("1.2.3.4", "a@b.com");
    expect(checkLoginAttempt("1.2.3.4", "a@b.com").allowed).toBe(true);
  });

  it("test_login_throttle_isolado_por_ip_email", () => {
    for (let i = 0; i < 5; i++) recordLoginFailure("1.2.3.4", "a@b.com");
    expect(checkLoginAttempt("9.9.9.9", "a@b.com").allowed).toBe(true);
    expect(checkLoginAttempt("1.2.3.4", "outro@b.com").allowed).toBe(true);
  });
});
