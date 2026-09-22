export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMeta = Record<string, unknown>;

export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta, error?: unknown): void;
  error(message: string, meta?: LogMeta, error?: unknown): void;
}

// Chaves sensíveis de meta: valores são mascarados antes de logar para nunca
// vazar email/telefone/senha/token/segredos em logs. Padrão do app `só`.
const SENSITIVE_KEY_PATTERN = /email|phone|celular|telefone|password|senha|token|cpf|secret|authorization/i;

export function sanitizeMeta(meta?: LogMeta): LogMeta {
  if (!meta) return {};
  const out: LogMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) && typeof value === "string" && value.length > 0 ? "[redacted]" : value;
  }
  return out;
}

const isProd = process.env.NODE_ENV === "production";

function write(level: LogLevel, message: string, meta?: LogMeta, error?: unknown): void {
  if (isProd && level === "debug") return;
  const line = `[lagoscrib] [${level.toUpperCase()}] ${new Date().toISOString()} ${message}`;
  const safe = sanitizeMeta(meta);
  const suffix = Object.keys(safe).length > 0 ? ` ${JSON.stringify(safe)}` : "";
  const errSuffix = error instanceof Error ? `\n  Error: ${error.message}` : error ? `\n  Detalhes: ${String(error)}` : "";
  const out = line + suffix + errSuffix;
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const logger: Logger = {
  debug: (message, meta) => write("debug", message, meta),
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta, error) => write("warn", message, meta, error),
  error: (message, meta, error) => write("error", message, meta, error),
};
