import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { auth } from "@/lib/auth";
import { extrairDoAnuncio } from "@/lib/imovel-import";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Importa UM imóvel a partir do link do anúncio. Não é coletor de lote (isso é
 * o scripts/coleta/coleta.mjs): aqui o usuário cola uma URL e o formulário
 * recebe os campos preenchidos para ele revisar antes de salvar.
 *
 * Por que passar pelo navegador e não por fetch: o Zap e o VivaReal respondem
 * 403 a fetch (Cloudflare) e o OLX precisa de sessão. O Chaves na Mão aceita
 * fetch puro, mas usar o mesmo caminho para os quatro evita duas implementações.
 * O perfil é sempre o Chromium do usuário, no --remote-debugging-port.
 *
 * O fetch das fotos é síncrono de propósito: 11 fotos do Chaves na Mão levam
 * ~2,4s e ~0,9 MB, então uma fila em background custaria mais caro do que o
 * trabalho que executaria.
 */

const PERFIL_CDP = process.env.CDP_URL ?? "http://127.0.0.1:9222";
const FOTOS = "public/imoveis";
const MAX_FOTOS = 11; // mesmo teto da base (merge.py corta photoUrls em 11)
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = (await req.json()) as { url?: string };
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Informe a URL do anúncio" }, { status: 400 });
  }

  const { chromium } = await import("@playwright/test");
  let browser;
  let pagina;
  try {
    browser = await chromium.connectOverCDP(PERFIL_CDP);
    const contexto = browser.contexts()[0];
    if (!contexto) throw new Error("navegador sem contexto");
    pagina = await contexto.newPage();
    const resp = await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (!resp || resp.status() >= 400) {
      return NextResponse.json(
        { error: `O portal respondeu HTTP ${resp?.status() ?? "?"} para essa URL` },
        { status: 502 },
      );
    }
    // O Chaves na Mão e outros portais montam parte do conteúdo no cliente (a
    // área dele fica atrás de skeleton loader), então espera a rede assentar.
    await pagina.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    const html = await pagina.content();
    const extraido = extrairDoAnuncio(html, url);

    const id = `import-${Date.now()}`;
    const salvas = await baixaFotos(extraido.photoUrls, id);

    return NextResponse.json({
      ok: true,
      imovel: {
        id,
        link: url,
        title: extraido.title,
        neighborhood: extraido.neighborhood,
        address: extraido.address,
        area: extraido.area,
        areaFrom: extraido.areaFrom,
        bedrooms: extraido.bedrooms,
        bathrooms: extraido.bathrooms,
        parking: extraido.parking,
        rent: extraido.rent,
        condo: extraido.condo,
        iptu: extraido.iptu,
        condoUnknown: extraido.condoUnknown,
        image: salvas.capa,
        photos: salvas.fotos,
      },
      avisos: extraido.avisos,
      fotosBaixadas: salvas.fotos.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao ler o anúncio: ${String(e).slice(0, 200)}` },
      { status: 502 },
    );
  } finally {
    // Só a aba que esta rota abriu: o navegador do usuário continua intacto.
    await pagina?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function baixaFotos(urls: string[], id: string): Promise<{ capa: string; fotos: string[] }> {
  if (!urls.length) return { capa: "", fotos: [] };
  await mkdir(join(FOTOS, id), { recursive: true });

  const fotos: string[] = [];
  for (const [i, u] of urls.slice(0, MAX_FOTOS).entries()) {
    try {
      const r = await fetch(u, { headers: { "user-agent": UA } });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      // Menos de 5 KB é placeholder/erro do CDN, não foto (mesma regra do
      // download.py: o Pillow também abriria HTML como erro).
      if (buf.length < 5000) continue;
      const rel = join(FOTOS, id, `${String(i + 1).padStart(2, "0")}.webp`);
      await writeFile(rel, buf);
      fotos.push("/" + rel.replace(/\\/g, "/"));
    } catch {
      // Uma foto que falha não derruba o import; a capa e o resto seguem.
    }
  }
  if (!fotos.length) return { capa: "", fotos: [] };

  // Capa avulsa, como o resto da base (o app usa image + photos[]).
  const r = await fetch(urls[0], { headers: { "user-agent": UA } });
  if (r.ok) {
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length >= 5000) await writeFile(join(FOTOS, `${id}.webp`), buf);
  }
  return { capa: `/imoveis/${id}.webp`, fotos };
}
