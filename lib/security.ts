const DEFAULT_ORIGINS = ["http://localhost:3000"];

function buildAllowedOrigins(): ReadonlySet<string> {
  const override = process.env.ALLOWED_ORIGINS;
  if (override && override.trim() !== "") {
    return new Set(
      override
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
  }
  const origins = new Set(DEFAULT_ORIGINS);
  return origins;
}

export const ALLOWED_ORIGINS: ReadonlySet<string> = buildAllowedOrigins();

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    return ALLOWED_ORIGINS.has(new URL(origin).origin);
  } catch {
    return false;
  }
}
