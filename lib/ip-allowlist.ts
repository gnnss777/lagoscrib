import { BlockList } from "node:net";

export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // O ÚLTIMO hop é o injetado pelo edge confiável (ex.: Vercel); o PRIMEIRO
    // é controlável pelo cliente e NÃO deve ser usado para allowlist.
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    return parts[parts.length - 1] || null;
  }
  return request.headers.get("x-real-ip") || null;
}

export function isIpAllowed(ip: string | null, allowlist: string): boolean {
  if (!ip) return false;
  try {
    const blockList = new BlockList();
    for (const entry of allowlist
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)) {
      if (entry.includes("/")) {
        const [addr, prefix] = entry.split("/");
        blockList.addSubnet(addr, Number(prefix));
      } else {
        blockList.addAddress(entry);
      }
    }
    return blockList.check(ip);
  } catch {
    return false;
  }
}
