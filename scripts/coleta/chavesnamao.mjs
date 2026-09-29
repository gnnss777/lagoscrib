// Coleta de imóveis — Chaves na Mão (leva 4, 29/09/2026).
// Escreve data/coleta/chaves-2q-ate3600-14b-l4.json no schema que
// data/coleta/merge.py espera. Coletor NOVO, no formato e com as mesmas regras
// do coleta.mjs — mas sem browser, e o motivo está no cabeçalho.
//
// Uso: node scripts/coleta/chavesnamao.mjs [--bairros=batel,centro] [--delay=2000]
//
// ---------------------------------------------------------------------------
// Por que `fetch` puro e não o browser do coleta.mjs
// ---------------------------------------------------------------------------
// O Chaves na Mão é Next.js com SSR: o HTML do PRIMEIRO GET já traz os 15
// anúncios da listagem e o payload RSC completo de cada página de anúncio
// (preço, condomínio, IPTU, área útil/total, quartos, suítes, banheiros, vagas,
// galeria e o telefone da imobiliária em `publisher.phones`). Não há Cloudflare
// nem botão "mostrar telefone": o número está no payload, o que também zera o
// registro de lead no painel do anunciante (AGENTS.md regra 5).
//
// O resto do `coleta.mjs` (--cdp=, clique em "mostrar telefone", 8s de ritmo por
// causa do Cloudflare) é workaround que aqui não existe. --cdp= é aceito e
// ignorado, para o comando continuar sendo o mesmo do AGENTS.md.
//
// ---------------------------------------------------------------------------
// robots.txt — o teto de páginas é do site, não nosso
// ---------------------------------------------------------------------------
//   Allow: /*?pg=2  /*?pg=3  /*?pg=4  /*?pg=5
//   Disallow: /*?*
// Só ?pg=2..5 tem Allow explícito e `/*?*` barra qualquer outra query. A
// página 1 é a URL sem query (por isso PG_MAX = 5 e nunca escrevemos ?pg=1).
// Nenhuma outra query pode entrar na URL de listagem — se aparecer, a leva
// vira infração de robots.
//
// ---------------------------------------------------------------------------
// Soft-404: URL errada devolve HTTP 200 com ZERO anúncios
// ---------------------------------------------------------------------------
// `alto-xv` (que não existe) e qualquer bairro digitado errado respondem 200 e
// listagem vazia. Por isso a validação é `anuncios > 0`, nunca o status.
//
// ---------------------------------------------------------------------------
// Anti-apagão e teto (regras do AGENTS.md que valem aqui)
// ---------------------------------------------------------------------------
// - `condo` desconhecido = 0 + `condoUnknown: true`. O portal tem um terceiro
//   estado ("Sem taxa de condomínio"), que é DECLARAÇÃO de zero, não ausência:
//   entra como condo 0 sem `condoUnknown`. Nenhum valor é estimado.
// - IPTU nunca estimado: se o portal não publica, fica 0.
// - Teto é o all-in (aluguel + condomínio + IPTU) <= R$ 3.600 — o mesmo
//   `TETO_TOTAL_ALUGUEL` de lib/constants.ts e de merge.py. Não é negociável.
//
// ---------------------------------------------------------------------------
// Reuso, e o que NÃO dá pra reusar
// ---------------------------------------------------------------------------
// `lib/imovel-import.ts` já faz o parse de página única deste portal (o
// comentário do `daGrade` foi escrito olhando a grade /imn/ do Chaves na Mão).
// Ele é TypeScript e importa `@/lib/neighborhoods`, então um `.mjs` rodado com
// node puro não consegue carregar — mesma razão que o próprio arquivo registra
// para não ter reimplementado `num`/`money` dele. Aqui as regexes que interessam
// (grade /imn/, "Sem taxa de condomínio", IPTU) estão portadas, e o resto vem
// do payload RSC, que o import por link não usa. Telefone: `melhorTelefone()` de
// telefone.mjs (normaliza E.164, mede o nono dígito e prefere celular).
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { melhorTelefone } from "./telefone.mjs";

const BASE = "https://www.chavesnamao.com.br";
const CIDADE = `${BASE}/imoveis-para-alugar/pr-curitiba`;
const OUT = "data/coleta";
const ARQ = "chaves-2q-ate3600-14b-l4";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const HOJE = new Date().toISOString().slice(0, 10);
const PG_MAX = 5; // robots.txt: Allow ?pg=2..5, Disallow /*?*
// Ritmo. 2s entre requisições: este site não tem Cloudflare (o 8s do coleta.mjs
// é contornar Cloudflare, não educação do portal), mas 70 listagens + N páginas
// de anúncio ainda é tráfego constante. `--delay=` sobe se o portal começar a
// devolver 429.
const DELAY = Number((process.argv.find((a) => a.startsWith("--delay=")) || "").split("=")[1] || 2000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Teto do produto: R$ 3.600 all-in. Espelha lib/constants.ts
// (TETO_TOTAL_ALUGUEL) e data/coleta/merge.py (MAX_TOTAL_ALUGUEL). Mesmo
// número nos três, travado em teste — se mudar, muda nos três.
const TETO_TOTAL = 3600;
// Alvo da leva: 2 ou 3 quartos, apartamento residencial, 14 bairros. Área
// >= 70 m² é desejável, não bloqueio (entra como info, não como filtro).
const QTS = new Set([2, 3]);

// Os 14 bairros da leva, no slug do portal. Todos conferidos no sitemap do
// site. `alto-xv` NÃO existe (200 + zero anúncio): o certo é `alto-da-rua-xv`.
const BAIRROS_ALVO = [
  "centro",
  "agua-verde",
  "batel",
  "bigorrilho",
  "portao",
  "reboucas",
  "centro-civico",
  "cristo-rei",
  "sao-francisco",
  "cabral",
  "merces",
  "alto-da-gloria",
  "alto-da-rua-xv",
  "juveve",
];

// ---------------------------------------------------------------- bairros
// lib/neighborhoods.ts é a fonte da verdade (LL-006). Slug do anúncio
// ("agua-verde") vira nome oficial. Bairro fora da lista = imóvel descartado,
// porque o card ficaria sem regional (cobertura.py).
function slug(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const OFICIAIS = (() => {
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
// nome oficial de um slug, se for bairro da lista
const oficial = (s) => OFICIAIS.get(slug(s)) || null;

// ---------------------------------------------------------------- números
// `num`/`money` reimplementados em vez de importados: lib/imovel-import.ts é TS
// com import de `@/lib/...`, que node puro não resolve. Mesma razão e mesma
// nota do coleta.mjs e do próprio imovel-import.ts.
const num = (v) => {
  if (v == null) return 0;
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3,}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
// "R$ 1.234" -> 1234 · "$undefined" -> 0. O payload RSC escreve ausente como
// "$undefined", então isto também é o filtro de "o portal não informou".
const money = (v) => {
  const m = String(v ?? "").match(/([\d.]{1,12}(?:,\d{1,2})?)/);
  return m ? num(m[1]) : 0;
};

const textoVisivel = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");

/**
 * Foto da galeria em 1280x853, servida em WebP pelo próprio portal.
 *
 * A grade faz parte do path (`/imn/<grade>/N/70/imoveis/...`), então trocar por
 * 1280x0853 devolve a imagem grande sem converter nada (medido: `RIFF` +
 * `image/webp` nas grades 0850x0450, 1200x0800 e 1280x0853). 1280x853 satisfaz
 * o gate de audit-photos.mjs (lado maior >= 800, menor >= 500) e o CDN não exige
 * Referer (medido), então `data/coleta/download.py` roda sem nada novo.
 * Mesma normalização do `daGrade` em lib/imovel-import.ts.
 */
const PREFIXO_FOTO = "https://www.chavesnamao.com.br/imn/1280x0853/N/70/imoveis/";
const daGrade = (u) => {
  const m = u.match(/^https:\/\/www\.chavesnamao\.com\.br\/imn\/\d+x\d+\/(.*)$/);
  return m ? `https://www.chavesnamao.com.br/imn/1280x0853/${m[1]}` : u;
};

/** Blocos ld+json, inclusive com o Product aninhado (achata em lib/imovel-import.ts). */
function ldJson(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* bloco inválido */
    }
  }
  const achatados = [];
  const achata = (o, prof = 0) => {
    if (!o || typeof o !== "object" || prof > 3) return;
    if (o["@type"]) achatados.push(o);
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) v.forEach((x) => achata(x, prof + 1));
      else achata(v, prof + 1);
    }
  };
  for (const o of out) achata(Array.isArray(o) ? o : [o]);
  return achatados;
}

// ---------------------------------------------------------------- payload RSC
/**
 * Janela do payload RSC que contém o objeto do anúncio, e só ele.
 *
 * O payload traz o imóvel e depois ~11 anúncios relacionados, TODOS com
 * `"showCondominium"` (medido: 12 ocorrências numa página de anúncio, 6 numa
 * comercial). A primeira é a do próprio imóvel, e a janela [-2000, +6000] em
 * torno dela cobre tudo que importamos: publisher/phones/area/category ANTES,
 * prices/pictures/realtyType/transaction/quartos/location/items DEPOIS
 * (distâncias medidas: publisher -1036, pictures +23, realtyType +2314,
 * transaction +2422, quartos +2521, location +2661, privativeItems +3204,
 * commonItems +3234; o próximo bloco, de anúncio relacionado, está em +230k).
 *
 * Âncora VALIDADA, não presumida: a janela só vale se a galeria ancorada for do
 * id da URL (`<publisherId>/<imovelId>/...`). Se não for, anda para a próxima
 * ocorrência. Sem essa checagem um anúncio relacionado contaminaria o dado — e
 * o preço/condomínio é exatamente o campo que não pode ser inventado.
 */
function blocoRsc(html, imovelId) {
  const d = html
    .replace(/\\"/g, '"')
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\n/g, "\n");
  const galeriaDeste = new RegExp(`pictures\\":\\{[^}]*"list":\\[[^\\]]*?/${imovelId}/`);
  for (let p = d.indexOf('"showCondominium"'); p >= 0; p = d.indexOf('"showCondominium"', p + 1)) {
    const janela = d.slice(Math.max(0, p - 2000), p + 6000);
    if (galeriaDeste.test(janela)) return janela;
  }
  return "";
}

// Dois acessos, porque no payload as coisas se repetem de um lado e de outro:
//
//   `antes`  -> ÚLTIMO match ANTES da âncora. O que o anúncio traz antes dela:
//              publisher (nome, CRECI, telefones, ENDEREÇO DA IMOBILIÁRIA), area,
//              category e prices. O `prices` é logo antes: sem este lado, o
//              `condominiumFee` e o `rawPrice` não seriam vistos.
//   `depois` -> PRIMEIRO match DEPOIS da âncora. O que vem depois: pictures,
//              realtyType, transaction, quartos/banheiros/vagas, location e as
//              listas de itens. Sem este lado, `addressNumber` e `neighborhood`
//              pegavam o ENDEREÇO DA IMOBILIÁRIA (a Sagle fica naRua Coronel
//              Dulcídio, 465 e o imóvel no 357 — mesma rua, números vizinhos).
//
// Medido no `chavesnamao-batel-104-3500`: as duas âncoras divergem em 8 campos.
const _pre = (janela) => {
  const p = janela.indexOf('"showCondominium"');
  return p >= 0 ? janela.slice(0, p) : janela;
};
const antes = (janela, re) => (_pre(janela).match(re) || [])[1] ?? "";
const depois = (janela, re) => {
  const p = janela.indexOf('"showCondominium"');
  return (((p >= 0 ? janela.slice(p) : janela).match(re)) || [])[1] ?? "";
};

/** Lê a página de UM anúncio. Devolve null quando o payload não é reconhecível. */
function extrair(html, url) {
  const imovelId = (url.match(/\/id-(\d+)\//) || [])[1] || "";
  if (!imovelId) return null;
  const j = blocoRsc(html, imovelId);
  if (!j) return null;
  const texto = textoVisivel(html);
  const blocos = ldJson(html);
  // Dois `RealEstateListing` no mesmo ld+json: o `mainEntity` do WebPage, que é
  // só `{"@type","@id"}`, e o anúncio completo. `find` no primeiro devolvia um
  // stub — sem `name`, sem `description`, sem `offers` — e o título/descrição
  // saíam vazios. Filtra por `name`, que só o completo tem.
  const lista =
    blocos.find((b) => b["@type"] === "RealEstateListing" && b.name) ??
    blocos.find((b) => b["@type"] === "RealEstateListing");
  // O Offer vem em `about.offers` e com @type "rentAction" (não "Offer").
  const oferta =
    lista?.offers ??
    lista?.about?.offers ??
    blocos.find((b) => b["@type"] === "Offer" || b["@type"] === "rentAction");
  const item = oferta?.itemOffered ?? {};
  const agente = oferta?.offeredBy ?? lista?.offeredBy ?? {};

  // Tipo do anúncio. Três fontes independentes: o slug da URL é o mais estável
  // ("sala-comercial-para-alugar…"), o RSC oficializa (`category` +
  // `realtyType.name`) e o ld+json confirma (`itemOffered.@type`). A listagem
  // mistura sala-comercial e prédio dentro dos bairros, então o filtro por tipo
  // é obrigatório (regra 4 do enunciado da leva).
  // O caminho, não a URL: aqui `url` já é absoluta e o `^` não casaria.
  const tipoSlug = (url.match(/\/imovel\/([a-z-]+?)-para-(?:alugar|vender)/) || [])[1] || "";
  const realtyType = depois(j, /"realtyType":\{"name":"([^"]*)"/);
  const category = antes(j, /"category":"(residential|commercial)"/);

  // Preços. `rawPrice` é o aluguel; `condominiumFee` e `iptuValue` vêm como
  // "R$ 760" ou "$undefined" (o portal não informou). Nada é estimado.
  const rawPrice = num(antes(j, /"rawPrice":(\d+)/));
  const fee = antes(j, /"condominiumFee":"([^"]*)"/);
  const iptuBruto = antes(j, /"iptuValue":"([^"]*)"/);

  // Condomínio tem TRÊS estados no portal e o coletor precisa distinguir os
  // três (ADR-001 §4):
  //   1._fee com valor          -> condomínio declarado, condoUnknown fora
  //   2. "Sem taxa de condomínio" -> DECLARAÇÃO de zero, condoUnknown fora
  //   3. sem valor e sem frase   -> desconhecido: 0 + condoUnknown: true
  const semFee = /sem\s+(taxa\s+)?(de\s+)?condom[íi]nio/i.test(texto);
  let condo = money(fee);
  let condoUnknown = false;
  if (!condo) {
    if (semFee) {
      condo = 0;
    } else {
      condo = 0;
      condoUnknown = true;
    }
  }
  // defense-in-depth: o texto é a fonte que o imovel-import.ts já usa, e o
  // payload pode faltar num anúncio novo. Se o payload disse um valor mas o
  // texto declara "sem taxa", o texto vence (é o que o anunciante escreveu).
  if (condo && semFee) {
    condo = 0;
  }
  const iptu = money(iptuBruto);

  // Área. `useful` é a privativa — é o que o app mostra e o que o `imovel-import`
  // já gravava antes (medido: o imóvel `chavesnamao-batel-104-3500` está com
  // area 104 e o payload dele diz useful 104 / total 110, que é o slug `110m2`).
  const areaUtil = num(antes(j, /"area":\{"total":"[^"]*","totalMax":"[^"]*","useful":"([^"]*)"/));
  const areaTotal = num(antes(j, /"area":\{"total":"([^"]*)"/));
  const area =
    areaUtil ||
    num(item.floorSize?.value) ||
    num((texto.match(/Área útil\s*([\d.,]{1,7})/) || [])[1]) ||
    areaTotal;

  // Rooms. O payload é a fonte autoritativa e corrige o que a leva anterior
  // gravou: `bathrooms.count` e `garages.count` são os reais (medido no
  // `chavesnamao-batel-104-3500`: payload 1 banheiro e nenhuma vaga, base com
  // 3 banheiros e 1 vaga).
  const quartos = num(depois(j, /"bedrooms":\{"count":(\d+)/));
  const banheiros = num(depois(j, /"bathrooms":\{"count":(\d+)/)) || num(item.numberOfBathroomsTotal);
  const vagas = num(depois(j, /"garages":\{"count":(\d+)/));

  const bairroPortal = depois(j, /"neighborhood":\{"id":\d+,"name":"([^"]*)"/);
  const bairro = oficial(bairroPortal);
  const rua = depois(j, /"street":\{"id":\d+,"name":"([^"]*)"/);
  const numero = depois(j, /"addressNumber":"([^"]*)"/);

  // Telefone: já vem no payload da imobiliária anunciante (`publisher.phones`).
  // Sem Cloudflare e sem botão "mostrar telefone", o que também zera o registro
  // de lead no painel do anunciante (AGENTS.md regra 5).
  //
  // O RÓTULO do campo não é confiável — o próprio portal grava celular no
  // `cellphone` com o NONO dígito perdido e o celular verdadeiro no `landline`
  // (medido no `id-32076815`: `cellphone` "(41) 9235-0200", `landline`
  // "(41) 99235-0200"). Ler pelo rótulo e deixar `telApolar` decidir — que só
  // mede comprimento — gravava `+554192350200`, que `ehTelefoneValido` reprova
  // por ser celular com um dígito a menos. Isso não se conserta adivinhando o 9:
  // se coleta TODOS os números publicados e deixa `melhorTelefone` medir o nono.
  const blocoPhones = antes(j, /"phones":\{[\s\S]*?\]\}/) || _pre(j);
  const phone = melhorTelefone([
    ...[...blocoPhones.matchAll(/"number":(null|"[^"]*")/g)].map((m) => m[1]),
    ...[...blocoPhones.matchAll(/"whatsapp":\[([^\]]*)\]/g)].flatMap((m) =>
      [...m[1].matchAll(/"([^"]+)"/g)].map((s) => s[1]),
    ),
    agente.telephone,
  ]).phone;
  const anunciante = antes(j, /"publisher":\{"logo":"[^"]*","name":"([^"]*)"/);
  const creci = antes(j, /"creci":"([^"]*)"/);

  // Galeria do próprio imóvel. `pictures.list` é a lista autoritativa (medido
  // count 20-25). Fallback: as URLs /imn/ da galeria no HTML, reescritas para
  // 1280x0853 — o caminho do `fotosDoAnuncio` de lib/imovel-import.ts.
  const listaFotos = depois(j, /"pictures":\{"count":\d+,"featured":"[^"]*","list":\[([^\]]*)\]/);
  let fotos = [...listaFotos.matchAll(/"([^"]+)"/g)].map((m) => PREFIXO_FOTO + m[1]);
  if (fotos.length < 8) {
    const doHtml = [...new Set([...html.matchAll(/https:\/\/www\.chavesnamao\.com\.br\/imn\/[^"'\s>\\]+/g)].map((m) => m[0]))]
      .filter((u) => /\/imoveis\/\d+\/${imovelId}\//.test(u))
      .filter((u) => !/logo|icone|icon-|placeholder|sprite|banner|selo/i.test(u))
      .map(daGrade);
    if (doHtml.length > fotos.length) fotos = doHtml;
  }
  fotos = [...new Set(fotos)];

  // Facilities das duas listas do payload (privativas + áreas comuns). Os nomes
  // vêm verbatim; o matching do app normaliza (lib/filters.ts).
  const nomes = (bloco) =>
    (bloco.match(/"name":"([^"]*)"/g) || []).map((s) => s.replace(/^"name":"/, "").replace(/"$/, ""));
  const itens = [
    ...nomes(depois(j, /"privativeItems":\[([^\]]*)\]/)),
    ...nomes(depois(j, /"commonItems":\[([^\]]*)\]/)),
  ];

  const descricao = String(lista?.description ?? item.description ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    imovelId,
    tipoSlug,
    realtyType,
    category,
    transaction: depois(j, /"transaction":"(RENT|SALE)"/),
    bairroPortal,
    bairro,
    rua,
    numero,
    area,
    areaUtil,
    areaTotal,
    quartos,
    banheiros,
    vagas,
    rent: rawPrice,
    condo,
    condoUnknown,
    iptu,
    fotos,
    phone,
    anunciante,
    creci,
    itens,
    descricao,
    titulo: String(lista?.name ?? item.name ?? "").trim(),
  };
}

// ---------------------------------------------------------------- http
const descartados = [];
const telefones = [];
// Anúncio repetido em duas listagens de bairro: mesmo fetch, mesmo payload, e a
// decisão refeita contra o bairro da vez. Antes era um `Set` e o segundo bairro
// pulava o anúncio inteiro — combinado com o filtro "bairro do anúncio difere da
// listagem", um anúncio cross-listado era descartado por engano. Memoizar o
// parse custa zero fetch e não perde ninguém.
const cache = new Map();
const coletados = new Set();
const fora = (bairro, ref, motivo) => {
  descartados.push({ fonte: "chavesnamao", bairro, ref, motivo });
};

async function abrir(url) {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" },
        signal: AbortSignal.timeout(45000),
      });
      const html = await r.text();
      await sleep(DELAY);
      return { status: r.status, html };
    } catch (e) {
      if (tentativa === 3) return { status: 0, html: "", erro: e.message };
      await sleep(DELAY * tentativa * 2);
    }
  }
}

/**
 * Links de anúncio da listagem de um bairro, com o pré-filtro do slug.
 *
 * O pré-filtro usa DADO DO PORTAL (o slug e o `title` do card são o texto que o
 * Chaves na Mão escreveu para o anúncio), não heurística: descarta só o que a
 * listagem já diz que não entra. O que sobra é conferido de novo na página do
 * anúncio, que é a fonte autoritativa — a listagem não é estoque de verdade.
 *
 * Slugs observados: `/imovel/apartamento-para-alugar-2-quartos-com-garagem-pr-
 * curitiba-batel-126m2-RS2950/id-46860454/`. O `126m2` é a área TOTAL e o
 * `RS2950` o aluguel; o card `title` traz a área útil ("75.25 m2"), que é a
 * que entra no app.
 */
function candidatos(html) {
  const saida = [];
  for (const m of html.matchAll(/<a\b[^>]*?\bhref="(\/imovel\/[^"]+)"[^>]*>/g)) {
    const href = m[1];
    const attrs = m[0];
    const tipo = (href.match(/^\/imovel\/([a-z-]+?)-para-(?:alugar|vender)/) || [])[1] || "";
    const qts = num((href.match(/-(\d+)-quarto/) || [])[1]);
    const rent = num((href.match(/-RS(\d+)/) || [])[1]);
    const card = (attrs.match(/\btitle="([^"]*)"/) || [])[1] || "";
    const areaCard = num((card.match(/([\d.,]{1,7})\s*m2/i) || [])[1]);
    saida.push({ href, tipo, qts, rent, areaCard, card });
  }
  return saida;
}

// ------------------------------------------------- reaplicar telefone no lote
// Modo de correção pontual, sem refazer a leva inteira:
//
//   node scripts/coleta/chavesnamao.mjs --reaplicar-telefone
//
// Existe porque uma leva já gravada em disco não se corrige rodando o coletor
// de novo: o resto dos campos (preço, condomínio, galeria) viraria outra leva,
// com outro teto e outra foto. Aqui só o telefone volta a ser lido do payload,
// pelo MESMO caminho do `extrair` acima — o conserto é na origem, não no JSON.
//
// Anti-apagão (AGENTS.md regra 3): imóvel que a página não publica mais, ou cuja
// página não respondeu, DÁ NA PAGINAÇÃO VELHA. Só um número explicitamente
// inválido no disco é zerado — nunca um vazio novo caindo por cima de algo bom.
const REAPLICAR = process.argv.includes("--reaplicar-telefone");
if (REAPLICAR) {
  const arq = `${OUT}/${ARQ}.json`;
  const leva = JSON.parse(readFileSync(arq, "utf8"));
  let mudou = 0, mesmo = 0, semPagina = 0, zerados = 0;
  const relatorio = [];
  for (const x of leva.imoveis) {
    const imovelId = x.chavesnamaoId || (x.link.match(/\/id-(\d+)\//) || [])[1] || "";
    const { status, html } = await abrir(x.link);
    // `extrair` é o MESMO caminho da coleta — nada de segunda implementação
    // do telefone aqui, que é como a divergência volta.
    const novo = imovelId && status === 200 ? extrair(html, x.link)?.phone || "" : "";
    const velho = x.phone || "";
    if (novo) {
      if (novo === velho) mesmo++;
      else mudou++;
      x.phone = novo;
    } else if (velho && !melhorTelefone([velho]).phone) {
      // o disco tem um número que o app reprova e a página não devolve um
      // válido: ficar com o lixo é pior que ficar sem número.
      zerados++;
      x.phone = "";
    } else {
      semPagina++;
    }
    relatorio.push({ id: x.id, link: x.link, antes: velho, depois: x.phone || "" });
    console.log(
      `  ${x.id}  ${velho || "-"} -> ${novo || "-"}` +
        (novo && novo !== velho ? "   MUDOU" : ""),
    );
  }
  writeFileSync(arq, JSON.stringify(leva, null, 1), "utf8");
  writeFileSync(
    `${OUT}/reaplicacao-telefone-chavesnamao.json`,
    JSON.stringify(
      {
        _regra:
          "celular tem prioridade, fixo é fallback (imobiliarias-telefone.json _regra); " +
          "so entra o que passa em ehTelefoneValido; nenhum dígito é inventado",
        total: leva.imoveis.length,
        mudou,
        mesmo,
        semPagina,
        zerados,
        relatorio,
      },
      null,
      1,
    ),
    "utf8",
  );
  console.log(
    `\nTELEFONE reaplicado em ${leva.imoveis.length}: mudou ${mudou}, igual ${mesmo}, ` +
      `manteve sem página ${semPagina}, zerado ${zerados}`,
  );
  console.log(`>>> ${arq} e ${OUT}/reaplicacao-telefone-chavesnamao.json`);
  process.exit(0);
}

// ---------------------------------------------------------------- main
mkdirSync(OUT, { recursive: true });
const soBairros = new Set(
  ((process.argv.find((a) => a.startsWith("--bairros=")) || "").split("=")[1] || "")
    .split(",")
    .map((b) => slug(b))
    .filter(Boolean),
);
const bairros = soBairros.size ? BAIRROS_ALVO.filter((b) => soBairros.has(b)) : BAIRROS_ALVO;
const itens = [];
const log = [];
const brutosPorBairro = new Map();
const candidatosPorBairro = new Map();
let erroHttp = 0;

for (const sl of bairros) {
  const nome = oficial(sl) || sl;
  //unique por bairro, guardando a melhor metadada de card vista
  const brutos = new Map();
  let paginasVazias = 0;

  // --- listagem: pg 1 (sem query) + pg 2..5, o teto do robots.txt
  for (let pg = 1; pg <= PG_MAX; pg++) {
    const url = pg === 1 ? `${CIDADE}/${sl}/` : `${CIDADE}/${sl}/?pg=${pg}`;
    const { status, html, erro } = await abrir(url);
    if (status === 0) erroHttp++;
    const achados = candidatos(html);
    // Soft-404: 200 + zero anúncio = bairro/página inexistente. Registra e
    // segue; não derruba a leva.
    if (!achados.length) {
      paginasVazias++;
      log.push({ bairro: sl, pg, status, erro: erro || "", n: 0, nota: "sem anuncios" });
      console.log(`  [${sl}] pg${pg} HTTP ${status} 0 anuncios (soft-404 ou pagina vazia)`);
      continue;
    }
    for (const a of achados) {
      const prev = brutos.get(a.href);
      if (!prev) brutos.set(a.href, { ...a, bairro: sl });
      else if (a.areaCard && !prev.areaCard) prev.areaCard = a.areaCard;
    }
    log.push({ bairro: sl, pg, status, erro: erro || "", n: achados.length, nota: "" });
    console.log(`  [${sl}] pg${pg} HTTP ${status} ${achados.length} anuncios`);
  }

  // --- pré-filtro do slug
  const candidatosBairro = [...brutos.values()];
  brutosPorBairro.set(sl, candidatosBairro.length);
  const pre = candidatosBairro.filter((a) => {
    if (a.tipo !== "apartamento") {
      fora(sl, a.href, `tipo ${a.tipo || "desconhecido"} (alvo: apartamento)`);
      return false;
    }
    if (a.qts && !QTS.has(a.qts)) {
      fora(sl, a.href, `${a.qts} quartos (alvo 2-3)`);
      return false;
    }
    if (a.rent && a.rent > TETO_TOTAL) {
      fora(sl, a.href, `aluguel R$${a.rent} acima do teto de R$${TETO_TOTAL}`);
      return false;
    }
    return true;
  });
  console.log(
    `  [${sl}] ${candidatosBairro.length} unicos brutos -> ${pre.length} candidatos apos pre-filtro do slug`,
  );
  candidatosPorBairro.set(sl, pre.length);
  if (paginasVazias === PG_MAX) console.log(`  [${sl}] ATENCAO: todas as ${PG_MAX} paginas vieram vazias`);

  // --- página de anúncio
  let passou = 0;
  for (const c of pre) {
    const url = `${BASE}${c.href}`;
    let reg = cache.get(url);
    if (!reg) {
      const { status, html, erro } = await abrir(url);
      if (status === 0) erroHttp++;
      reg = { status, erro: erro || "", x: status === 200 && html ? extrair(html, url) : null };
      cache.set(url, reg);
    }
    const { status, erro, x } = reg;
    if (status !== 200 || !x) {
      fora(sl, c.href, status === 200 ? "payload RSC do anuncio nao reconhecido" : `HTTP ${status} ${erro || "sem corpo"}`);
      continue;
    }

    // ---- filtros autoritativos (a página manda, não o slug nem o card)
    if (x.transaction !== "RENT") {
      fora(sl, c.href, `transacao ${x.transaction || "?"} (alvo aluguel)`);
      continue;
    }
    if (x.category !== "residential" || x.tipoSlug !== "apartamento") {
      fora(
        sl,
        c.href,
        `nao residencial (category=${x.category || "?"} tipo=${x.tipoSlug || "?"} realtyType=${x.realtyType || "?"})`,
      );
      continue;
    }
    if (!x.bairro) {
      fora(sl, c.href, `bairro "${x.bairroPortal || "?"}" fora da lista oficial`);
      continue;
    }
    if (slug(x.bairro) !== sl) {
      fora(sl, c.href, `bairro do anuncio "${x.bairro}" difere da listagem "${nome}"`);
      continue;
    }
    if (!QTS.has(x.quartos)) {
      fora(sl, c.href, `${x.quartos} quartos (alvo 2-3)`);
      continue;
    }
    if (!x.rent) {
      fora(sl, c.href, "aluguel ausente no payload");
      continue;
    }
    // O slug carrega o aluguel do próprio anúncio (`-RS2800`). Medido: bate com
    // `rawPrice` nos imóveis de Batel. Divergindo, NENHUM dos dois é confiado —
    // o imóvel é descartado, nunca gravado com o preço adivinhado (AGENTS.md
    // regra 2, ADR-001 §4).
    if (c.rent && c.rent !== x.rent) {
      fora(sl, c.href, `aluguel do slug (R$${c.rent}) difere do payload (R$${x.rent})`);
      continue;
    }
    const total = x.rent + x.condo + x.iptu;
    if (total > TETO_TOTAL) {
      fora(
        sl,
        c.href,
        `all-in R$${total} (aluguel ${x.rent} + condo ${x.condo} + iptu ${x.iptu}) acima do teto de R$${TETO_TOTAL}`,
      );
      continue;
    }
    if (!x.area) {
      fora(sl, c.href, "area ausente no payload");
      continue;
    }
    if (x.fotos.length < 8) {
      fora(sl, c.href, `fotos<8 (${x.fotos.length})`);
      continue;
    }

    // ---- monta o registro no schema do merge.py
    if (coletados.has(x.imovelId)) {
      console.log(`  [${sl}] = ${x.imovelId} ja coletado em outro bairro (dedupe)`);
      continue;
    }
    coletados.add(x.imovelId);
    const end = x.numero ? `, ${x.numero}` : "";
    const registro = {
      id: `chavesnamao-${slug(x.bairro)}-${x.area}-${x.rent}-${x.imovelId}`.slice(0, 90),
      title: (x.titulo || `Apartamento para alugar — ${x.bairro}`).slice(0, 120),
      neighborhood: x.bairro,
      address: `${x.rua}${end}, ${x.bairro}, Curitiba - PR`,
      area: x.area,
      bedrooms: x.quartos,
      bathrooms: x.banheiros,
      parking: x.vagas,
      rent: x.rent,
      condo: x.condo,
      iptu: x.iptu,
      total,
      phone: x.phone,
      link: url,
      // CRECI é da imobiliária, não do imóvel: vai no rótulo da fonte, não em
      // `codigoAnunciante` (que no merge.py/generate.py é chave de dedupe por
      // imóvel — enchê-lo com CRECI colidiria toda a carteira da imobiliária).
      source: [x.anunciante ? `Chaves na Mão · ${x.anunciante}` : "Chaves na Mão", x.creci && `CRECI ${x.creci}`]
        .filter(Boolean)
        .join(" · "),
      chavesnamaoId: x.imovelId,
      features: x.itens,
      description: x.descricao,
      photosCount: x.fotos.length,
      photoUrls: x.fotos,
      verifiedAt: HOJE,
    };
    // ADR-001 §4: desconhecido é 0 + condoUnknown, nunca estimativa. Já vem
    // setado em extrair(); a linha abaixo é só a garantia explícita.
    if (x.condoUnknown) registro.condoUnknown = true;

    itens.push(registro);
    telefones.push({ fonte: "chavesnamao", ref: x.imovelId, phone: x.phone, anunciante: x.anunciante });
    passou++;
    console.log(
      `  [${sl}] + ${x.bairro} ${x.area}m2 ${x.quartos}qt R$${x.rent} cond=${x.condo}${x.condoUnknown ? "?" : ""} iptu=${x.iptu} total=${total} fotos=${x.fotos.length} tel=${x.phone || "-"}`,
    );
  }
  console.log(`  [${sl}] ${passou} passaram o filtro de ${pre.length} candidatos\n`);
}

// ---------------------------------------------------------------- relatório
const comTel = itens.filter((x) => x.phone).length;
const pctTel = itens.length ? Math.round((comTel / itens.length) * 100) : 0;

const resumoBairro = (sl) => {
  const nome = oficial(sl) || sl;
  return {
    bairro: nome,
    slug: sl,
    brutos: brutosPorBairro.get(sl) ?? 0,
    candidatos: candidatosPorBairro.get(sl) ?? 0,
    passou: itens.filter((x) => slug(x.neighborhood) === sl).length,
  };
};
const tabela = bairros.map(resumoBairro);

writeFileSync(`${OUT}/${ARQ}.json`, JSON.stringify({ imoveis: itens }, null, 1), "utf8");
writeFileSync(
  `${OUT}/descartados-chavesnamao-l4.json`,
  JSON.stringify(descartados, null, 1),
  "utf8",
);
writeFileSync(`${OUT}/log-chavesnamao-l4.json`, JSON.stringify({ paginas: log, porBairro: tabela }, null, 1), "utf8");
writeFileSync(`${OUT}/telefones-chavesnamao-l4.json`, JSON.stringify(telefones, null, 1), "utf8");

console.log("\n=================== Chaves na Mão ===================");
console.log("bairro                bruto  cand   passou");
for (const t of tabela) {
  console.log(
    `${t.bairro.padEnd(20)} ${String(t.brutos).padStart(6)} ${String(t.candidatos).padStart(6)} ${String(t.passou).padStart(7)}`,
  );
}
const totalBruto = tabela.reduce((a, t) => a + t.brutos, 0);
console.log(
  `\nTOTAL bruto: ${totalBruto} | candidatos: ${tabela.reduce((a, t) => a + t.candidatos, 0)} | passou o filtro: ${itens.length}`,
);
console.log(`Telefone: ${comTel}/${itens.length} (${pctTel}%)`);
if (erroHttp) console.log(`ERROS HTTP: ${erroHttp}`);
if (itens.length && !comTel) {
  console.log("AVISO: zero telefone em toda a leva — o payload mudou de campo? (AGENTS.md regra 2)");
} else if (!comTel) {
  console.log("AVISO: leva vazia — nenhum imóvel passou o filtro.");
}
console.log(`\nmotivos de descarte:`);
const contagem = new Map();
for (const d of descartados) {
  const k = d.motivo.replace(/\d+/g, "N").replace(/<[^>]*>/g, "");
  contagem.set(k, (contagem.get(k) || 0) + 1);
}
for (const [k, v] of [...contagem].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}
console.log(`\n>>> ${OUT}/${ARQ}.json : ${itens.length} imoveis`);


