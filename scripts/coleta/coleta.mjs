// Coleta de imóveis — leva 4 (27/09/2026). Escreve data/coleta/<fonte>-l4.json
// no schema que data/coleta/merge.py espera.
//
// Uso: node scripts/coleta/coleta.mjs [--qtd-zap=10] [--qtd-viva=10] [--qtd-olx=20] [--qtd-apolar=10]
//
// Por que browser real e não fetch: Zap e VivaReal respondem 403 a fetch e o
// Cloudflare barra Chromium headless (LL-045). Edge real + perfil persistente
// passa; o perfil fica em %TEMP%/coleta-edge-profile e guarda o cf_clearance.
// O ritmo é 8s por navegação: abaixo disso o Cloudflare bloqueia (testado).
//
// Por que o scraper é determinístico (sem LLM no loop):
// - Zap/VivaReal: slug do anúncio (quartos/m²/bairro) + ld+json Product
//   (sku = id, offers.price = aluguel, image[] = galeria) + innerText do DOM
//   (condomínio, IPTU, banheiros, vagas, endereço).
// - OLX: ld+json Product (identifier = olxId, url, description).
// - Apolar: API JSON pública (execute-api .../properties/search/main) + as URLs
//   reais de anúncio lidas da listagem paginada.
//
// Zap e VivaReal são a mesma plataforma (Zap Group, mesmo espaço de ids): um id
// visto no Zap é pulado no VivaReal, senão o mesmo imóvel entra duas vezes.
// ADR-001 §4: condomínio ausente vira condo 0 + condoUnknown, nunca estimativa.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const PROFILE = "C:/Users/gnnss/AppData/Local/Temp/coleta-edge-profile";
const OUT = "data/coleta";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const HOJE = new Date().toISOString().slice(0, 10);
const DELAY = 8000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const arg = (nome, padrao) => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit ? Number(hit.split("=")[1]) : padrao;
};
// Leva 4: OLX não entrega lista orgânica (só os 71 anúncios patrocinados do
// homefeed em toda variante de URL — ver docs/stories/S008). Os 20 do OLX foram
// redistribuídos: Apolar 20 (API, 1 request) + Zap 15 + VivaReal 15 = 50.
// Zap e VivaReal são a mesma plataforma, então ids vistos num são pulados no outro.
const QTD = {
  zap: arg("qtd-zap", 15),
  viva: arg("qtd-viva", 15),
  olx: arg("qtd-olx", 0),
  apolar: arg("qtd-apolar", 20),
};

// ---------------------------------------------------------------- bairros
// lib/neighborhoods.ts é a fonte da verdade (LL-006). Slug do anúncio
// ("agua-verde") vira nome oficial. Bairro fora da lista = imóvel descartado,
// porque o card ficaria sem regional (cobertura.py).
function slug(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const BAIRROS = (() => {
  const src = readFileSync("lib/neighborhoods.ts", "utf8");
  const mapa = new Map();
  for (const m of src.matchAll(/neighborhoods:\s*\[([\s\S]*?)\]/g)) {
    for (const nome of m[1].matchAll(/"([^"]+)"/g)) mapa.set(slug(nome[1]), nome[1]);
  }
  const alias = src.match(/MARKET_ALIAS_REGIONAL[^=]*=\s*\{([\s\S]*?)\}/);
  if (alias) for (const nome of alias[1].matchAll(/"([^"]+)":/g)) mapa.set(slug(nome[1]), nome[1]);
  if (mapa.size < 70) throw new Error(`lib/neighborhoods.ts: só ${mapa.size} bairros, esperado ~75`);
  return mapa;
})();
// nome oficial -> nome, para varrer o texto do anúncio
const BAIRRO_POR_NOME = new Map([...BAIRROS.values()].map((n) => [n.toLowerCase(), n]));

function bairroDe(texto) {
  if (!texto) return null;
  const s = slug(texto);
  if (BAIRROS.has(s)) return BAIRROS.get(s);
  for (const parte of s.split("-")) if (BAIRROS.has(parte)) return BAIRROS.get(parte);
  return null;
}

// Varre o texto à procura de um bairro conhecido. Prefere o mais longo
// ("Santa Quitéria" antes de "Quitéria") e exige nome com 5+ letras para não
// casar palavra comum ("Centro", "Batel" aparecem em texto de bairro).
function bairroNoTexto(texto) {
  if (!texto) return null;
  const t = " " + texto.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ") + " ";
  let melhor = null;
  for (const [nome, oficial] of BAIRRO_POR_NOME) {
    if (nome.length < 5) continue;
    if (!t.includes(" " + nome + " ")) continue;
    if (!melhor || oficial.length > melhor.length) melhor = oficial;
  }
  return melhor;
}

// "1.234,56" -> 1235 · "45.5" -> 46 · "134" -> 134
const num = (v) => {
  if (v == null) return 0;
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3,}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const money = (txt) => {
  const m = (txt || "").match(/R\$\s*([\d.]{1,12}(?:,\d{1,2})?)/);
  return m ? num(m[1]) : 0;
};
const RUA = /(?:Rua|Avenida|Av\.|Alameda|Travessa|Estrada|Rodovia)\s+[A-ZÀ-Ú][\wÀ-ÿ\s]{2,48}?(?:,\s*\d{1,5})?(?=\s*(?:\||$))/;

function ruaDe(texto) {
  if (!texto) return "";
  const m = texto.match(RUA);
  return m ? m[0].replace(/\s+/g, " ").trim() : "";
}

// ---------------------------------------------------------------- browser
mkdirSync(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: "msedge",
  headless: false,
  userAgent: UA,
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
  viewport: { width: 1440, height: 900 },
  args: ["--disable-blink-features=AutomationControlled"],
  ignoreDefaultArgs: ["--enable-automation"],
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const descartados = [];
const idsVistos = new Set();
let apolarSufixo = "";
const fora = (fonte, ref, motivo) => descartados.push({ fonte, ref, motivo });

async function abrir(url, espera = DELAY) {
  const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(espera);
  return r?.status() ?? 0;
}

function ldJson(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* bloco inválido */
    }
  }
  return out;
}

const hrefs = () =>
  page.evaluate(() => [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") || ""))]);

// Acha toda string que pareça URL dentro de uma estrutura qualquer (array,
// objeto, objeto indexado). A API do Apolar muda o formato de popup_fotos
// entre respostas, então não dá pra assumir array de objeto.
function coletarUrls(no) {
  const out = [];
  const visitar = (v, profundidade) => {
    if (!v || profundidade > 5) return;
    if (typeof v === "string") {
      if (/^https?:\/\/\S+\.(?:jpe?g|png|webp|avif)/i.test(v)) out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) visitar(item, profundidade + 1);
      return;
    }
    if (typeof v === "object") {
      for (const chave of ["URLArquivo", "url", "Url", "URL", "foto", "Foto"]) {
        if (v[chave] != null) visitar(v[chave], profundidade + 1);
      }
      for (const k of Object.keys(v)) if (!/^(URLArquivo|url|Url|URL|foto|Foto)$/.test(k)) visitar(v[k], profundidade + 1);
    }
  };
  visitar(no, 0);
  return [...new Set(out)];
}

// ---------------------------------------------------------------- Zap/VivaReal
// Zap: /aluguel/apartamentos/pr+curitiba/  ·  VivaReal: /aluguel/parana/curitiba/
// --quartos=2,3: preenche ?quartos= na busca do Zap/VivaReal e filtra no
// cliente a lista da API do Apolar (o filtro bedrooms dela é inconsistente:
// pede 4,5,6 e devolve 2 e 3 quartos). A leva 4 mira 2-3 quartos.
const QTS_BUSCA = (process.argv.find((a) => a.startsWith("--quartos=")) || "").split("=")[1] || "";
const QTS_SET = QTS_BUSCA ? new Set(QTS_BUSCA.split(",").map(Number).filter(Boolean)) : null;
const SUFIXO_BUSCA = QTS_BUSCA ? `?quartos=${QTS_BUSCA}` : "";
const prox = (u) => (QTS_BUSCA ? `${u}${SUFIXO_BUSCA}` : u);
const sufixoQts = QTS_BUSCA ? `-${QTS_BUSCA.replace(/,/g, "")}q` : "";

const BUSCAS = {
  zap: [
    "https://www.zapimoveis.com.br/aluguel/apartamentos/pr+curitiba/",
    "https://www.zapimoveis.com.br/aluguel/imoveis/pr+curitiba/",
  ],
  viva: [
    "https://www.vivareal.com.br/aluguel/parana/curitiba/apartamento/",
    "https://www.vivareal.com.br/aluguel/parana/curitiba/",
  ],
};

async function coletarZap(portal) {
  const field = portal === "zap" ? "zapId" : "vivaId";
  const fonte = portal === "zap" ? "Zap Imóveis" : "VivaReal";
  let base = null;
  for (const u of BUSCAS[portal]) {
    const alvo = prox(u);
    const st = await abrir(alvo);
    const n = (await hrefs()).filter((h) => h.includes("/imovel/")).length;
    console.log(`  [${portal}] ${st} ${n} imoveis :: ${alvo.slice(24)}`);
    if (st === 200 && n > 3) {
      base = alvo;
      break;
    }
  }
  if (!base) {
    console.log(`  [${portal}] nenhuma URL de busca respondeu`);
    return [];
  }

  const sep = base.includes("?") ? "&" : "?";
  const alvos = [];
  for (let p = 1; alvos.length < QTD[portal] * 3 && p <= 6; p++) {
    if (p > 1) {
      const st = await abrir(`${base}${sep}pagina=${p}`);
      if (st !== 200) break;
    }
    const achados = (await hrefs()).filter((h) => h.includes("/imovel/") && /aluguel-/.test(h));
    console.log(`  [${portal}] pagina ${p}: ${achados.length} anuncios`);
    for (const l of achados) alvos.push(l.split("?")[0]);
  }

  const saida = [];
  for (const url of [...new Set(alvos)]) {
    if (saida.length >= QTD[portal]) break;
    const pid = (url.match(/-id-(\d+)/) || [])[1];
    if (!pid) continue;
    if (idsVistos.has(pid)) {
      console.log(`  [${portal}] id ${pid} ja visto no outro portal — pulando`);
      continue;
    }
    const st = await abrir(url);
    const html = await page.content();
    const prod = ldJson(html).find((b) => b?.["@type"] === "Product");
    if (st !== 200 || !prod) {
      fora(portal, pid, `HTTP ${st} sem ld+json Product`);
      continue;
    }
    const texto = await page.evaluate(() => document.body.innerText);
    const h1 = await page.evaluate(() => document.querySelector("h1")?.innerText?.trim() || "");
    const bairroSlug = (url.match(/-([a-z0-9-]+)-curitiba-pr-/) || [])[1] || "";
    const bairro = bairroDe(bairroSlug) || bairroNoTexto(prod.name || "") || bairroNoTexto(texto.slice(0, 1500));
    const area = num((url.match(/-(\d+(?:[.,]\d+)?)m2-/) || [])[1] || (texto.match(/([\d.,]{2,7})\s*m²/) || [])[1]);
    const quartos = num((url.match(/-(\d+)-quarto/) || [])[1] || (texto.match(/(\d+)\s*quarto/) || [])[1]);
    const banheiros = num((texto.match(/(\d+)\s*banheiro/) || [])[1]);
    const vagas = num((texto.match(/(\d+)\s*vaga/) || [])[1]);
    const rent = num(prod.offers?.price);
    const condo = money((texto.match(/(?:Valor (?:d|e) )?Condomínio[\s\S]{0,60}/i) || [])[0]);
    const iptu = money((texto.match(/IPTU[\s\S]{0,60}/i) || [])[0]);
    const rua = ruaDe(texto.slice(0, 2500));
    const fotos = [...new Set((prod.image || []).map((u) => String(u).replace(/\\u0026/g, "&")))];

    if (!bairro) {
      fora(portal, pid, `bairro fora da lista (${bairroSlug || (prod.name || "").slice(0, 40)})`);
      continue;
    }
    if (!rent || !area || !quartos) {
      fora(portal, pid, `incompleto (rent=${rent} area=${area} qtos=${quartos})`);
      continue;
    }
    if (fotos.length < 8) {
      fora(portal, pid, `fotos<8 (${fotos.length})`);
      continue;
    }
    const features = [
      ...new Set(
        (
          await page.evaluate(() =>
            [...document.querySelectorAll("li")]
              .map((li) => (li.innerText || "").trim().replace(/\s+/g, " "))
              .filter((t) => t && t.length < 30 && !/^[\d.,]+\s*(m²|quarto|banheiro|vaga)/i.test(t)),
          )
        ).filter((t) => !/^(Metragem|Quartos|Banheiros|Vagas|Suítes)\b/i.test(t)),
      ),
    ].slice(0, 10);
    const anunciante = (texto.match(/Código do anunciante:\s*([\w-]+)/) || [])[1] || "";

    const partes = [portal, slug(bairro), slug(rua), String(area), pid.slice(-4)];
    idsVistos.add(pid);
    saida.push({
      id: partes.filter(Boolean).join("-"),
      title: (h1 || prod.name || `Apartamento para alugar — ${bairro}`).slice(0, 120),
      neighborhood: bairro,
      address: `${rua || bairro}, ${bairro}, Curitiba - PR`,
      area,
      bedrooms: quartos,
      bathrooms: banheiros,
      parking: vagas,
      rent,
      condo,
      iptu,
      total: rent + condo + iptu,
      link: url,
      source: anunciante ? `${fonte} · ${anunciante}` : fonte,
      [field]: pid,
      features,
      description: (prod.description || "").replace(/\s+/g, " ").trim(),
      photosCount: fotos.length,
      photoUrls: fotos,
      verifiedAt: HOJE,
    });
    console.log(
      `  [${portal}] + ${saida.length}/${QTD[portal]} ${bairro} ${area}m2 ${quartos}qt R$${rent} cond=${condo} iptu=${iptu}`,
    );
    if (!condo) saida[saida.length - 1].condoUnknown = true;
  }
  return { itens: saida, sufixo: sufixoQts };
}

// ---------------------------------------------------------------- OLX
async function coletarOlx() {
  const busca = "https://pr.olx.com.br/regiao-de-curitiba-e-paranagua/imoveis/aluguel/apartamentos";
  const alvos = [];
  for (let p = 1; alvos.length < QTD.olx * 4 && p <= 10; p++) {
    const st = await abrir(p === 1 ? busca : `${busca}?page=${p}`);
    if (st !== 200) break;
    const ids = (await hrefs())
      .filter((h) => /\/vi\/\d+/.test(h))
      .map((h) => h.match(/\/vi\/(\d+)/)?.[1])
      .filter(Boolean);
    console.log(`  [olx] pagina ${p}: ${ids.length} anuncios`);
    for (const id of ids) alvos.push(id);
  }

  const saida = [];
  for (const oid of [...new Set(alvos)]) {
    if (saida.length >= QTD.olx) break;
    const url = `https://www.olx.com.br/vi/${oid}`;
    const st = await abrir(url);
    const html = await page.content();
    const prod = ldJson(html).find((b) => b?.["@type"] === "Product");
    // A listagem mistura com o "Em alta" (eletrodomésticos etc). O anúncio real
    // de imóvel tem /imoveis/ na URL canônica do ld+json.
    if (st !== 200 || !prod || !/\/imoveis\//.test(prod.url || "")) {
      fora("olx", oid, `fora do escopo (HTTP ${st}, url=${(prod?.url || "").slice(-40)})`);
      continue;
    }
    const texto = await page.evaluate(() => document.body.innerText);
    const h1 = await page.evaluate(() => document.querySelector("h1")?.innerText?.trim() || "");
    const fotos = [...new Set([...html.matchAll(/https:\/\/img\.olx\.com\.br\/[^"'\\ ]+/g)].map((m) => m[0]))];
    const bairro =
      bairroNoTexto(h1) ||
      bairroNoTexto((texto.match(/Bairro:?\s*([^\n]{3,40})/i) || [])[1] || "") ||
      bairroNoTexto(texto.slice(0, 1200));
    const area = num((texto.match(/([\d.,]{2,7})\s*m²/) || [])[1]);
    const quartos = num((texto.match(/(\d+)\s*quarto/) || [])[1]);
    const banheiros = num((texto.match(/(\d+)\s*banheiro/) || [])[1]);
    const vagas = num((texto.match(/(\d+)\s*vaga/) || [])[1]);
    const rent =
      money((texto.match(/Aluguel[\s\S]{0,40}/i) || [])[0]) || money((texto.match(/R\$\s*[\d.]{3,}/) || [])[0]);
    const iptu = money((texto.match(/IPTU[\s\S]{0,40}/i) || [])[0]);
    const desc = (prod.description || "").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();

    if (!bairro) {
      fora("olx", oid, `bairro nao identificado (${(h1 || prod.name || "").slice(0, 50)})`);
      continue;
    }
    if (!rent || !area || !quartos) {
      fora("olx", oid, `incompleto (rent=${rent} area=${area} qtos=${quartos})`);
      continue;
    }
    if (fotos.length < 8) {
      fora("olx", oid, `fotos<8 (${fotos.length})`);
      continue;
    }
    saida.push({
      id: `olx-${slug(bairro)}-${area}-${oid.slice(-5)}`,
      title: (h1 || prod.name || `Apartamento para alugar — ${bairro}`).slice(0, 120),
      neighborhood: bairro,
      address: `${ruaDe(texto.slice(0, 1500)) || bairro}, ${bairro}, Curitiba - PR`,
      area,
      bedrooms: quartos,
      bathrooms: banheiros,
      parking: vagas,
      rent,
      condo: 0,
      condoUnknown: true,
      iptu,
      total: rent + iptu,
      link: prod.url || url,
      source: "OLX",
      olxId: oid,
      features: [],
      description: desc,
      photosCount: fotos.length,
      photoUrls: fotos,
      verifiedAt: HOJE,
    });
    console.log(`  [olx] + ${saida.length}/${QTD.olx} ${bairro} ${area}m2 ${quartos}qt R$${rent} iptu=${iptu}`);
  }
  return saida;
}

// ---------------------------------------------------------------- Apolar (API)
const APOLAR_API = "https://uiyek91vqe.execute-api.us-east-1.amazonaws.com/prod/properties/search/main";
const APOLAR_FIELDS = [
  "IsFeiraoApolar", "nomeEvento", "tipo", "transacao", "finalidade", "cidade", "bairro",
  "referencia", "Quartos", "condominio", "garagem", "dormitorios", "areaterreno",
  "area_total", "banheiro", "ValorAnterior", "valor_considerado", "situacao", "FimPromocao",
  "foto_principal", "endereco", "linksite", "Selo", "popup_fotos", "descricao",
  "vlrcondominio", "iptu", "valor_total", "loja", "lojacelular", "lojatelefone", "idtipomoeda",
];

async function coletarApolar() {
  const sufixo = sufixoQts;
  // 1. URLs reais de anúncio: a listagem paginada traz
  // /alugar/curitiba/<bairro>/alugar-residencial-apartamento-curitiba-<bairro>-<ref>?
  // (a API devolve só ?ref=, que abre a home — inútil como banco de links).
  const porRef = new Map();
  const listagem = "https://www.apolar.com.br/alugar/apartamento/curitiba";
  for (let p = 1; porRef.size < 200 && p <= 5; p++) {
    const st = await abrir(p === 1 ? listagem : `${listagem}?pagina=${p}`, 5000);
    if (st !== 200) break;
    const achados = (await hrefs()).filter((h) => /apolar\.com\.br\/alugar\/curitiba\/.+-(\d{4,})\??$/.test(h));
    for (const h of achados) {
      const ref = h.match(/-(\d{4,})\??$/)?.[1];
      if (ref) porRef.set(ref, h);
    }
    console.log(`  [apolar] listagem pagina ${p}: ${achados.length} anuncios (total ${porRef.size})`);
  }

  // 2. Dados ricos via API
  await abrir(listagem, 5000);
  const bruto = await page.evaluate(
    async ([api, fields, qtos]) => {
      const r = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          business: "Locacao", business_subfilter: "", reference: "",
          city: "Curitiba", country: "Brasil", district: [],
          property_type: ["Apartamento"], property_type_combo: [],
          bedrooms: qtos, garage: [], bathrooms: [],
          price_max: "R$ 0,00", price_min: "R$ 0,00",
          area_max: "0,00 m²", area_min: "0,00 m²",
          address: null, address_number: null, open_search: "",
          in_condominium: false, include_condominium_price: false,
          conveniences: [], recreation: [], facilities: [], rooms: [], idLoja: null,
          use_scroll: true, showStoreImmobiles: true, order: "price_asc",
          size: 200, fields,
          price: [0, 0], area: [0, 0],
        }),
      });
      return await r.json();
    },
    [APOLAR_API, APOLAR_FIELDS, QTS_BUSCA ? [...QTS_SET].map(String) : []],
  );
  const brutos = bruto?.data ?? [];
  // Filtro de quartos no cliente: o campo bedrooms da API não é confiável.
  const itens = QTS_SET
    ? brutos.filter((x) => QTS_SET.has(num(x.Quartos) || num(x.dormitorios)))
    : brutos;
  console.log(
    `  [apolar] API: ${brutos.length} anuncios, ${itens.length} no filtro quartos=${[...(QTS_SET ?? [])].join(",") || "todos"}`,
  );
  apolarSufixo = sufixo;

  const saida = [];
  for (const x of itens) {
    if (saida.length >= QTD.apolar) break;
    const ref = x.referencia;
    if (!ref) continue;
    const bairro = bairroDe(x.bairro) || bairroNoTexto(x.endereco || "");
    const area = num(x.area_total);
    const quartos = num(x.Quartos || x.dormitorios);
    const banheiros = num(x.banheiro);
    const vagas = num(x.garagem);
    const rent = num(x.valor_considerado);
    const iptu = num(x.iptu);
    // valor_total = aluguel + condomínio + IPTU. Quando vlrcondominio/condominio
    // vêm vazios, o condomínio é a diferença — não é estimativa (ADR-001 §4).
    let condo = num(x.vlrcondominio);
    if (!condo) {
      const derivado = Math.round((num(x.valor_total) || 0) - rent - iptu);
      condo = derivado > 0 ? derivado : 0;
    }
    let link = porRef.get(String(ref)) || "";
    if (!link) {
      // A API devolve ?ref=<codigo>, que redireciona para a página do anúncio.
      // Seguir o redirect grava a URL canônica permanente no banco de links
      // (o ?ref= da leva antiga apontava só para a home — ADR-001 §5).
      const st = await abrir(x.linksite || `https://www.apolar.com.br/?ref=${ref}`, 4500);
      const final = page.url();
      if (st === 200 && /\/alugar\/curitiba\/.+-\d{4,}$/.test(final)) link = final;
      else {
        fora("apolar", ref, `?ref= nao resolveu para o anuncio (HTTP ${st})`);
        continue;
      }
    }
    // popup_fotos vem como OBJETO (dict indexado), não array; cada entrada tem
    // URLArquivo como array de string. Achata recursivo, sem assumir o formato.
    const fotos = coletarUrls(x.popup_fotos);

    if (!bairro) {
      fora("apolar", ref, `bairro fora da lista (${x.bairro})`);
      continue;
    }
    if (!rent || !area || !quartos) {
      fora("apolar", ref, `incompleto (rent=${rent} area=${area} qtos=${quartos})`);
      continue;
    }
    if (fotos.length < 8) {
      fora("apolar", ref, `fotos<8 (${fotos.length})`);
      continue;
    }
    if (!porRef.has(String(ref)) && !link.startsWith("https://www.apolar.com.br/alugar/")) {
      fora("apolar", ref, "sem URL de anúncio");
      continue;
    }
    saida.push({
      id: `apolar-${slug(bairro)}-${slug(x.endereco)}-${area}-${ref}`.slice(0, 90),
      title: `${x.tipo || "Apartamento"} para alugar — ${bairro}`.slice(0, 120),
      neighborhood: bairro,
      address: `${x.endereco || bairro}, ${bairro}, Curitiba - PR`,
      area,
      bedrooms: quartos,
      bathrooms: banheiros,
      parking: vagas,
      rent,
      condo,
      iptu,
      total: rent + condo + iptu,
      link,
      source: "Apolar · LocaAção",
      apolarId: String(ref),
      features: [],
      description: String(x.descricao || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      photosCount: fotos.length,
      photoUrls: fotos,
      verifiedAt: HOJE,
    });
    if (!condo) saida[saida.length - 1].condoUnknown = true;
    console.log(
      `  [apolar] + ${saida.length}/${QTD.apolar} ${bairro} ${area}m2 ${quartos}qt R$${rent} fotos=${fotos.length}`,
    );
  }
  return { itens: saida, sufixo: apolarSufixo };
}

// ---------------------------------------------------------------- main
const salvo = {};
async function save(fonte, itens) {
  salvo[fonte] = itens;
  writeFileSync(`${OUT}/${fonte}-l4.json`, JSON.stringify({ imoveis: itens }, null, 1), "utf8");
  console.log(`>>> ${OUT}/${fonte}-l4.json : ${itens.length} imoveis\n`);
}

try {
  const so = (process.argv.find((a) => a.startsWith("--so=")) || "").split("=")[1];
  const quer = (f) => !so || so === f;
  if (quer("apolar")) {
    console.log("== apolar (API) ==");
    const r = await coletarApolar();
    await save(`apolar${r.sufixo}`, r.itens);
  }
  if (quer("zap")) {
    console.log("== zap (html) ==");
    const r = await coletarZap("zap");
    await save(`zap${r.sufixo}`, r.itens);
  }
  if (quer("viva")) {
    console.log("== vivareal (html) ==");
    const r = await coletarZap("viva");
    await save(`viva${r.sufixo}`, r.itens);
  }
  if (quer("olx")) {
    console.log("== olx (html) ==");
    if (QTD.olx > 0) await save("olx", await coletarOlx());
    else console.log("== olx: pulado (qtd-olx=0; lista organica nao renderiza) ==");
  }
} catch (e) {
  console.error("FALHA:", e.message);
  process.exitCode = 1;
} finally {
  writeFileSync(`${OUT}/descartados-l4.json`, JSON.stringify(descartados, null, 1), "utf8");
  const total = Object.values(salvo).reduce((a, b) => a + b.length, 0);
  console.log(`TOTAL: ${total} | descartados: ${descartados.length}`);
  await ctx.close();
}
