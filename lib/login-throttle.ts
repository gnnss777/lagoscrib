/**
 * Throttle de tentativas de login contra força bruta no endpoint de
 * credentials do NextAuth. Em memória por processo — mitiga o ataque por
 * instância; a barreira final é o custo do bcrypt. Padrão do app `só`.
 */

type AttemptEntry = { count: number; lockedUntil: number; windowStart: number };

const attempts = new Map<string, AttemptEntry>();

const MAX_FAILURES = 5;
const LOCK_MS = 60_000;
const WINDOW_MS = 15 * 60 * 1000;

function keyOf(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase().trim()}`;
}

export function checkLoginAttempt(ip: string, email: string): { allowed: boolean; retryAfterSeconds: number } {
  const entry = attempts.get(keyOf(ip, email));
  const now = Date.now();
  if (entry && entry.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordLoginFailure(ip: string, email: string): void {
  const k = keyOf(ip, email);
  const now = Date.now();
  const entry = attempts.get(k);
  if (!entry || entry.windowStart <= now - WINDOW_MS) {
    attempts.set(k, { count: 1, lockedUntil: 0, windowStart: now });
    return;
  }
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) entry.lockedUntil = now + LOCK_MS;
}

export function clearLoginAttempts(ip: string, email: string): void {
  attempts.delete(keyOf(ip, email));
}

export function clearAllLoginAttempts(): void {
  attempts.clear();
}
