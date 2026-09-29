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
 * Dois caminhos de leitura, nesta ordem:
 *
 * 1. Navegador (CDP no Chromium do usuário, --remote-debugging-port). É o
 *    único que resolve Zap e VivaReal (403 a fetch, por Cloudflare) e OLX
 *    (exige sessão). Só funciona na máquina do usuário, e por isso é opt-in
 *    via CDP_URL: em produção a Vercel não tem navegador, e carregar o
 *    Playwright (devDependency) dentro da função estourava a requisição.
 * 2. Fetch puro, sem navegador. O Chaves na Mão e o Apolar respondem assim.
 *    O que se perde: a área que o portal carrega no cliente (vem da URL, com
 *    aviso para o usuário conferir) e os portais que bloqueiam.
 *
 * O fetch das fotos é síncrono de propósito: 11 fotos do Chaves na Mão levam
 * ~2,4s e ~0,9 MB, então uma fila em background custaria mais caro que o
 * trabalho que executaria.
 */

const PERFIL_CDP = process.env.CDP_URL; // definido só na máquina do usuário
const FOTOS = "public/imoveis";
const MAX_FOTOS = 11; // mesmo teto da base (merge.py corta photoUrls em 11)
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Lê a página no Chromium do usuário. Devolve null se não houver navegador. */
async function leNoNavegador(url: string): Promise<string | null> {
  if (!PERFIL_CDP) return null;
  const { chromium } = await import("@playwright/test");
  let browser;
  let pagina;
  try {
    browser = await chromium.connectOverCDP(PERFIL_CDP);
    const contexto = browser.contexts()[0];
    if (!contexto) return null;
    pagina = await contexto.newPage();
    const resp = await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (!resp || resp.status() >= 400) return null;
    // Parte do conteúdo é montada no cliente (a área do Chaves na Mão fica
    // atrás de skeleton loader), então espera a rede assentar.
    await pagina.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    return await pagina.content();
  } catch {
    // Porta fechada ou navegador ocupado: quem chama decide o próximo passo.
    return null;
  } finally {
    await pagina?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = (await req.json()) as { url?: string };
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Informe a URL do anúncio" }, { status: 400 });
  }

  let html = await leNoNavegador(url);
  let viaNavegador = true;
  if (!html) {
    // Sem navegador: tenta fetch puro. Serve para o Chaves na Mão e o Apolar.
    viaNavegador = false;
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "pt-BR,pt;q=0.9" } });
      if (!r.ok) {
        return NextResponse.json(
          {
            error:
              r.status === 403
                ? "Esse portal bloqueia leitura sem navegador (403). Rode o import pela sua máquina, com o Chromium aberto na porta 9222 — o app de desenvolvimento faz isso."
                : `O portal respondeu HTTP ${r.status} para essa URL.`,
          },
          { status: 502 },
        );
      }
      html = await r.text();
    } catch (e) {
      return NextResponse.json(
        { error: `Não consegui ler a URL: ${String(e).slice(0, 120)}` },
        { status: 502 },
      );
    }
  }

  const extraido = extrairDoAnuncio(html, url);
  if (!viaNavegador) {
    extraido.avisos.push(
      "lido sem navegador (produção): a área pode ter vindo da URL, e portais que exigem sessão não funcionam por aqui",
    );
  }

  const id = `import-${Date.now()}`;

  // Serverless nao tem disco para guardar foto: o diretorio do projeto e
  // read-only e o /tmp some quando a funcao recicla. Entao la a gente devolve a
  // URL remota e deixa o download de verdade para o pipeline local
  // (scripts/coleta/chavesnamao.mjs + data/coleta/download.py), que ja tem
  // WebP em disco. Ver `vercel logs`: sem isso a rota morria com
  // ENOENT no mkdir de public/imoveis.
  const semDisco = Boolean(process.env.VERCEL);
  let salvas = { capa: "", fotos: [] as string[] };
  if (semDisco) {
    extraido.avisos.push(
      "fotos NAO baixadas: em deploy o disco e efemero. Os dados do anuncio vieram; para as fotos em WebP use a leva local",
    );
  } else {
    // Mouthpiece de rede: falhar em escrever foto e um aviso, nunca um 500 que
    // perde os campos que o usuario sobe a mao para conferir.
    salvas = await baixaFotos(extraido.photoUrls, id).catch((e) => {
      extraido.avisos.push(`fotos nao salvas em disco: ${String(e).slice(0, 120)}`);
      return { capa: "", fotos: [] as string[] };
    });
  }

  return NextResponse.json({
    ok: true,
    viaNavegador,
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
      fotosRemotas: semDisco ? extraido.photoUrls.slice(0, MAX_FOTOS) : undefined,
    },
    avisos: extraido.avisos,
    fotosBaixadas: salvas.fotos.length,
  });
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
