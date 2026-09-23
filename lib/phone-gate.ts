/**
 * Gate de telefone por horário comercial (plano §5.1, DECIDIDO 22/09/2026).
 * Telefone do corretor exibido SÓ em horário comercial; fora dele, só link.
 * Funções puras — o enforcement real acontece na rota de API, que OMITE o
 * campo `phone` do JSON fora do horário (nunca só esconder no client).
 */

export const BUSINESS_TZ = process.env.BUSINESS_TZ ?? "America/Sao_Paulo";
export const BUSINESS_START_HOUR = Number(process.env.BUSINESS_HOURS_START ?? 9);
export const BUSINESS_END_HOUR = Number(process.env.BUSINESS_HOURS_END ?? 18);
// 0=dom … 6=sáb. Padrão: seg–sex.
export const BUSINESS_DAYS = (process.env.BUSINESS_DAYS ?? "1,2,3,4,5")
  .split(",")
  .map((d) => Number(d.trim()))
  .filter((d) => d >= 0 && d <= 6);

function partsInTz(date: Date, timeZone: string): { hour: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "";
  // Mapeia dia da semana pt-BR (dom./seg./ter./qua./qui./sex./sáb.) → 0–6.
  const map: Record<string, number> = {
    dom: 0,
    seg: 1,
    ter: 2,
    qua: 3,
    qui: 4,
    sex: 5,
    sáb: 6,
  };
  const key = weekdayStr.replace(".", "").slice(0, 3).toLowerCase();
  return { hour, weekday: map[key] ?? -1 };
}

export function isBusinessHours(now: Date = new Date()): boolean {
  const { hour, weekday } = partsInTz(now, BUSINESS_TZ);
  if (!BUSINESS_DAYS.includes(weekday)) return false;
  return hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
}

/** Máscara de exibição: (41) 9****-**42. Nunca expor o número completo fora do gate. */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 6) return "(**) *****-****";
  const head = d.length > 10 ? d.slice(0, 2) : "";
  const tail = d.slice(-2);
  return head ? `(${head}) 9****-**${tail}` : `9****-**${tail}`;
}
