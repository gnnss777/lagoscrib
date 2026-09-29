// Coleta de imóveis — QuintoAndar, aluguel em Curitiba. Fonte SECUNDÁRIA da
// rodada: o slug da busca é um RAIO DE MAPA, não o bairro, e o teto de
// R$ 3.600 all-in corta quase tudo. Escreve
// data/coleta/quinto-2q-ate3600-14b-l4.json no schema que data/coleta/merge.py
// espera.
//
// Uso: node scripts/coleta/quintoandar.mjs [--delay=2500] [--quartos=2,3]
//      [--teto-total=3600] [--bairros=Batel,Cabral] [--retry=3]
//
// ------------------------------------------------------------------ por que
// fetch puro, sem browser
// A busca e a página de detalhe respondem HTTP 200 a `fetch`, sem Cloudflare e
// sem sessão: o payload é um Next.js com `<script id="__NEXT_DATA__">`. O
// browser real (padrão do coleta.mjs) existe por causa do Cloudflare do Zap e do
// VivaReal — aqui ele só custaria 8s por navegação sem trazer dado novo.
// CDP segue OPCIONAL: com ele dá pra clicar em "mostrar telefone" no fim, e o
// clique registra lead (AGENTS.md regra 5), então o padrão é não clicar.
//
// ------------------------------------------------------------------ por que
// NÃO existe paginação (e por que este script não tenta)
// `?page=2`, `?pagina=2`, `?offset=24`, `?limit=100`, `?sort=`, `?zoom=`,
// `/page/2/` e mais 10 variações devolvem o MESMO lote: o payload do servidor só
// tem a chave "0" de `visibleHouses.pages`, nunca página 1. Teto real: ~25
// imóveis por slug. A única forma de ampliar a oferta é variar o slug — por isso
// os 14 bairros aqui, um request de busca cada. `visibleHouses.total` é a
// contagem do mapa (160 em Batel), não o que dá para raspar: fica no log como
// `mapa`, e a conta real é `ids`.
//
// ------------------------------------------------------------------ telefone
// ZERO por construção, e isso é MEDIDO neste script, não assumido. HouseInfo
// não tem chave `phone` nenhuma; o único campo de contato do payload é
// `publisherWhatsapp: ""`, e o HTML do servidor não traz o texto "mostrar
// telefone" nem nenhum `a[href^="tel:"]` — o botão é client-side. Por isso a
// varredura `telefoneNoPayload()` roda em TODO imóvel que passa no filtro e o
// resultado sai no relatório: 0% é número medido, e se um dia o portal publicar
// o número no servidor, ele aparece aqui sem ninguém mexer no script.
// O número do anunciante só sai depois do clique, que REGISTRA LEAD no painel do
// anunciante (AGENTS.md regra 5) — fica para uma leva com `--cdp=` e DELAY entre
// cliques, logando quais imóveis foram clicados. Aqui: `phone: ""`.
// AGENTS.md regra 2: leva com zero telefone é para REPORTAR, nunca para
// inventar número.
//
// ------------------------------------------------------------------ a fórmula
// do all-in tem CINCO termos, não três
//     totalCost = rentPrice + condoPrice + iptu + tenantServiceFee + homeProtection
// Reconferido em cada página (delta logado no relatório; veio 0 em todas).
// Cortar em 3 termos deixa todo imóvel ~4% abaixo do all-in real: o schema
// Apartment não tem campo para taxa de serviço nem seguro, então merge.py
// recalcula `total` como aluguel+condomínio+IPTU e a diferença fica escrita na
// descrição do imóvel em vez de ser escondida.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { telApolar } from "./telefone.mjs";

const BASE_SITE = "https://www.quintoandar.com.br";
// xxl (1152x768) é o maior tamanho que existe no CDN. NÃO existe parâmetro de
// resize (testado: é ignorado em silêncio), então `xxl` é a escolha e não uma
// preferência estética. Já passa no piso de pixel do audit-photos.mjs (lado
// maior >= 800, menor >= 500) sem resize, e download.py não reescreve a URL
// (não há `dimension=` nem `WId=`), então a foto chega no tamanho cheio e vira
// WebP lá.
const FOTO_BASE = `${BASE_SITE}/img/xxl`;
const OUT = "data/coleta";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const HOJE = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const arg = (nome, padrao) => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit ? hit.split("=").slice(1).join("=") : padrao;
};
// 2.5s entre requisições. O coleta.mjs usa 8s porque o Cloudflare barra abaixo
// disso (LL-045); aqui não há Cloudflare, mas ~75 requisições seguidas já
// produziram ECONNRESET e ENFOUND de DNS (medido). 2.5s + backoff exponencial
// dá folga sem transformar a leva em 45 minutos. --delay= sobe se precisar.
const DELAY = Number(arg("delay", 2500));
const RETRY = Number(arg("retry", 3));
const TETO_TOTAL = Number(arg("teto-total", 3600));
const QTS_ALVO = new Set(
  (arg("quartos", "2,3") || "")
    .split(",")
    .map((x) => Number(x))
    .filter(Boolean),
);
// Tipos que o app aceita: apartamento. O QuintoAndar devolve também Casa,
// StudioOuKitchenette e Hotel na mesma busca — nenhum cabe no produto, e
// StudioOuKitchenette/Hotel vêm com condoPrice=0 (imóvel servido, não
// residencial). Whitelist, não blacklist: qualquer tipo novo cai fora e o
// histograma sai no resumo, então a próxima leva vê o que foi descartado.
const TIPOS_OK = new Set(["Apartamento", "Cobertura"]);

// ---------------------------------------------------------------- bairros
// lib/neighborhoods.ts é a fonte da verdade (LL-006). Os 14 slugs do QuintoAndar
// viram nome oficial por ele, e o bairro do IMÓVEL é conferido contra a mesma
// lista — bairro fora da lista é card sem regional (cobertura.py).
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
  if (mapa.size < 70) throw new Error(`lib/neighborhoods.ts: só ${mapa.size} bairros, esperado ~75`);
  return mapa;
})();

// Slug do QuintoAndar → nome oficial. 14 bairros, 1 request de busca cada.
const SLUGS_ALVO = [
  "batel",
  "centro",
  "agua-verde",
  "bigorrilho",
  "cabral",
  "portao",
  "cristo-rei",
  "juveve",
  "reboucas",
  "merces",
  "alto-da-gloria",
  "sao-francisco",
  "centro-civico",
  "alto-da-rua-xv",
];
const SO = new Set(
  (arg("bairros", "") || "")
    .split(",")
    .map((b) => slug(b))
    .filter(Boolean),
);
const ALVOS = SLUGS_ALVO.filter((s) => !SO.size || SO.has(s)).map((s) => ({
  slug: s,
  nome: BAIRROS.get(s) || s,
}));

// ---------------------------------------------------------------- helpers
const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// Retry no transporte. `fetch` puro no QuintoAndar quebra com ECONNRESET e
// ENFOUND (DNS) depois de ~75 requests rápidos, então a espera cresce por
// tentativa. 4xx não é transitório: devolve "" na hora em vez de gastar retry.
async function pegar(url) {
  for (let t = 1; t <= RETRY; t++) {
    await sleep(DELAY * (t === 1 ? 1 : 2 ** (t - 1)));
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } });
      if (r.ok) return await r.text();
      if (r.status < 500) return "";
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (t === RETRY) console.log(`  [http] ${url.slice(24)} falhou: ${String(e).slice(0, 60)}`);
    }
  }
  return "";
}

// Os 5 termos do all-in, e o delta contra o totalCost do próprio portal.
function custos(hi) {
  const rent = num(hi.rentPrice);
  const condo = num(hi.condoPrice);
  const iptu = num(hi.iptu);
  const taxaServico = num(hi.tenantServiceFee);
  const seguro = num(hi.homeProtection);
  const allIn = rent + condo + iptu + taxaServico + seguro;
  return { rent, condo, iptu, taxaServico, seguro, allIn, delta: allIn - num(hi.totalCost) };
}

// A armadilha: ~3% das páginas trazem houseInfo EXISTENTE e zerado
// (rentPrice=0, area=0, photos=[], condominium={}). Passa por qualquer filtro de
// preço e envenena a base — o único sintoma é o imóvel "barato demais".
// Detecção: houseInfo ausente, rentPrice zerado OU galeria vazia. Um orçamento
// só, o do RETRY: re-fetch até o dado vir, e o que não vem sai por "erro".
let esqueletoVezes = 0;
let esqueletoResolvidos = 0;
let esqueletoPersistentes = 0;

async function detalhe(id) {
  for (let t = 1; t <= RETRY; t++) {
    const html = await pegar(`${BASE_SITE}/imovel/${id}`);
    if (!html) return { erro: "sem HTML" };
    const hi = nextData(html)?.props?.pageProps?.initialState?.house?.houseInfo;
    if (hi && hi.rentPrice && (hi.photos || []).length) {
      if (t > 1) esqueletoResolvidos++;
      return { hi };
    }
    if (t === 1) {
      esqueletoVezes++;
      console.log(`  [esqueleto] ${id} veio zerado, re-fetch 1/${RETRY}`);
    }
  }
  esqueletoPersistentes++;
  return { erro: `houseInfo esqueleto depois de ${RETRY} tentativas` };
}

// Bairro do IMÓVEL, nunca o do slug. `condominium.neighborhood` é o bairro do
// prédio (fonte confiável); `address.neighborhood` é o rótulo do anúncio e
// mente — medido em 4 de 8 imóveis do slug "batel": o prédio está em Água Verde
// e o anúncio se autodenomina "Batel". Por isso a ordem é condominium primeiro.
// Null = bairro fora da lista de alvos, imóvel descartado.
function bairroDoDetalhe(hi) {
  const bruto = hi.condominium?.neighborhood || hi.address?.neighborhood || "";
  return BAIRROS.get(slug(bruto)) || null;
}

// Andar, do jeito que o próprio portal escreve no card ("Até 3° andar",
// "4° a 7° andar"). Não é enfeite: o QuintoAndar publica a MESMA unidade em
// vários andares como anúncios separados com o mesmo endereço, mesma área e
// mesmos quartos (medido: Rua Paula Gomes 434, 76m², 2 quartos, ids 892907822 e
// 892907800). merge.py deduplica por (endereço, área, quartos) e jogaria um dos
// dois fora como se fosse o mesmo imóvel. O andar é o que os distingue, e é o
// que o usuário lê no anúncio.
function andarDe(hi) {
  const { min, max } = hi.rangeFloor || {};
  if (!Number.isFinite(min)) return "";
  if (!Number.isFinite(max) || min === max) return `${min}º andar`;
  if (min <= 1) return `até ${max}º andar`;
  return `${min}º a ${max}º andar`;
}

// Capa primeiro: é a foto que o anunciante escolheu, e o app usa photoUrls[0]
// como capa. O nome do arquivo pode vir com prefixo `original` e a extensão
// varia (.jpg/.jpeg/.JPG) — por isso a URL é montada a partir do nome exato que
// veio no payload, sem assumir sufixo. `photos` é a galeria do IMÓVEL;
// `condominium.images` é a do prédio e não entra.
function fotosDe(hi) {
  const lista = (hi.photos || []).filter((p) => p && p.url);
  lista.sort((a, b) => Number(!!b.cover) - Number(!!a.cover));
  return [...new Set(lista.map((p) => `${FOTO_BASE}/${encodeURIComponent(p.url)}`))];
}

// Comodidades com value SIM, do imóvel e do condomínio. O vocabulário do portal
// já é o das FACILITY_GROUPS (lib/constants.ts), então o filtro de comodidades do
// app casa sem normalização extra.
function comodidadesDe(hi) {
  const out = [];
  for (const lista of [hi.amenities || [], hi.installations || [], hi.condominium?.features?.installations || []]) {
    for (const c of lista) {
      if (c && c.value === "SIM" && c.text) out.push(c.text);
    }
  }
  return [...new Set(out)].slice(0, 10);
}

// Varredura do payload atrás de telefone, SÓ nos imóveis que passam no filtro.
// Existe para que "0% de telefone" seja número medido e não chute: se o portal
// passar a publicar o número no HTML do servidor, ele aparece aqui sem ninguém
// mexer no script. Só desce em caminho cujo NOME parece contato, para não pagar
// varredura profunda em 300 imóveis descartados.
let telefoneCaminhos = new Set();
function telefoneNoPayload(hi) {
  const achados = new Set();
  const visitar = (v, caminho, prof) => {
    if (prof > 8 || v == null) return;
    if (typeof v === "string") {
      if (!/(phone|telefone|whats|contato|celular)/i.test(caminho)) return;
      const d = v.replace(/\D/g, "");
      if ([10, 11, 12, 13].includes(d.length)) achados.add(`${caminho} = ${v}`);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) visitar(x, caminho, prof + 1);
      return;
    }
    if (typeof v === "object") for (const k of Object.keys(v)) visitar(v[k], `${caminho}.${k}`, prof + 1);
  };
  visitar(hi, "", 0);
  for (const a of achados) telefoneCaminhos.add(a);
  return [...achados];
}

// id estável e ÚNICO. A rua pode ser comprida demais e o `.slice(0, 90)` do
// schema cortaria o sufixo do id do portal — dois imóveis da mesma rua ficariam
// com o mesmo id. Aqui o corte é na RUA e o sufixo (6 dígitos do id do portal)
// fica sempre inteiro.
function idDe(bairro, rua, area, id) {
  const base = `quinto-${slug(bairro)}-`;
  const sufixo = `-${num(area)}-${id.slice(-6)}`;
  return base + slug(rua).slice(0, 90 - base.length - sufixo.length) + sufixo;
}

// ---------------------------------------------------------------- main
mkdirSync(OUT, { recursive: true });
const descartados = [];
const vistos = new Set();
const porSlug = new Map();
const tiposVistos = new Map();
const deltas = new Map();
let totalIds = 0;
let vettidos = 0;
let repetidos = 0;
const fora = (codigo, id, sl, motivo) => {
  descartados.push({ fonte: "QuintoAndar", ref: id, busca: sl, codigo, motivo });
  const p = porSlug.get(sl);
  if (p) p.motivos.set(codigo, (p.motivos.get(codigo) || 0) + 1);
};
const itens = [];

console.log(
  `QuintoAndar · ${ALVOS.length} slugs · delay ${DELAY}ms · teto all-in R$${TETO_TOTAL} · quartos ${[...QTS_ALVO].join("/")}\n`,
);

for (const alvo of ALVOS) {
  const est = { nome: alvo.nome, slug: alvo.slug, mapa: 0, ids: 0, vettidos: 0, passou: 0, repetidos: 0, motivos: new Map() };
  porSlug.set(alvo.slug, est);

  const busca = `${BASE_SITE}/alugar/imovel/${alvo.slug}-curitiba-pr-brasil/`;
  const html = await pegar(busca);
  const search = nextData(html)?.props?.pageProps?.initialState?.search;
  const pagina = search?.visibleHouses?.pages?.["0"] ?? [];
  est.mapa = num(search?.visibleHouses?.total);
  est.ids = pagina.length;
  totalIds += pagina.length;
  console.log(
    `  [${alvo.nome}] busca: ${pagina.length} ids no lote (mapa declara ${est.mapa}; o payload só tem a página "0" e não pagina)`,
  );
  if (!pagina.length) {
    console.log(`  [${alvo.nome}] busca sem ids — slug morto ou bloqueado`);
    continue;
  }

  for (const id of pagina) {
    // O raio de mapa faz o mesmo imóvel aparecer em slugs vizinhos. Dedup por id
    // do portal: o mesmo imóvel duas vezes no JSON é imóvel duas vezes no app.
    if (vistos.has(id)) {
      est.repetidos++;
      repetidos++;
      continue;
    }
    vistos.add(id);
    est.vettidos++;
    vettidos++;

    const { hi, erro } = await detalhe(id);
    if (erro) {
      fora("erro", id, alvo.slug, erro);
      continue;
    }
    const c = custos(hi);
    tiposVistos.set(hi.type ?? "(vazio)", (tiposVistos.get(hi.type ?? "(vazio)") || 0) + 1);
    deltas.set(c.delta, (deltas.get(c.delta) || 0) + 1);

    if (!TIPOS_OK.has(hi.type)) {
      fora("tipo", id, alvo.slug, `tipo ${hi.type} fora do produto`);
      continue;
    }
    if (!QTS_ALVO.has(num(hi.bedrooms))) {
      fora("quartos", id, alvo.slug, `${num(hi.bedrooms)} quartos fora do alvo`);
      continue;
    }
    const bairro = bairroDoDetalhe(hi);
    if (!bairro) {
      fora(
        "bairro",
        id,
        alvo.slug,
        `bairro fora da lista (${hi.condominium?.neighborhood || hi.address?.neighborhood || "?"})`,
      );
      continue;
    }
    if (!c.rent || !num(hi.area)) {
      fora("incompleto", id, alvo.slug, `incompleto (rent=${c.rent} area=${num(hi.area)})`);
      continue;
    }
    // condoPrice=0 com condomínio nomeado é imóvel SERVIDO, não residencial: o
    // próprio anúncio diz que o aluguel já inclui o condomínio, e Hotel/
    // StudioOuKitchenette (que já saíram no filtro de tipo) vêm sempre assim.
    // Deixar entrar faria o all-in passar do teto com um condomínio que não
    // existe no preço. O portal é quem publica o 0, mas aqui o 0 é "embutido no
    // aluguel", não "isento" — e é por isso que a regra do ADR-001 §4 (condo
    // desconhecido = 0 + condoUnknown) não se aplica: o preço existe, e só não
    // é o preço de um apartamento.
    if (!c.condo) {
      fora(
        "condo-zero",
        id,
        alvo.slug,
        `condoPrice 0 = servido/não residencial (${hi.condominium?.name || "sem nome"})`,
      );
      continue;
    }
    // Corte no all-in de 5 termos — é o que o usuário paga. O filtro de preço do
    // portal (não usado aqui) é só por aluguel, então sem este corte entra
    // imóvel de R$ 2.500 de aluguel com R$ 1.300 de condomínio.
    if (c.allIn > TETO_TOTAL) {
      fora("acima-teto", id, alvo.slug, `all-in R$${c.allIn} acima do teto de R$${TETO_TOTAL}`);
      continue;
    }
    const fotos = fotosDe(hi);
    if (fotos.length < 8) {
      fora("fotos", id, alvo.slug, `fotos<8 (${fotos.length})`);
      continue;
    }

    // Só aqui, no fim de todos os filtros: o telefone é o único campo que pode
    // custar algo ao anunciante, então não se gasta leitura em imóvel descartado.
    const telAchado = telefoneNoPayload(hi);
    const tel = telAchado.map((a) => a.split(" = ")[1]).map(telApolar).find(Boolean) || "";

    // Rua: a que o PORTAL mostra no card (`address.street`, verificado no texto
    // renderizado: "Início Curitiba Rebouças Avenida Sete de Setembro"). O
    // `condominium.address` é o endereço do PRÉDIO e nem sempre é o mesmo —
    // medido em 893029010: o anúncio é na Avenida Sete de Setembro e o
    // condomínio fica na Rua André de Barros, 226 (mesma esquina). O número só
    // entra quando as duas batem, senão seria número de outra rua.
    const ruaPortal = hi.address?.street || hi.condominium?.address || "";
    const numero = hi.condominium?.number && slug(hi.condominium?.address || "") === slug(ruaPortal)
      ? hi.condominium.number
      : "";
    const ruaFull = [ruaPortal, numero].filter(Boolean).join(", ");
    const andar = andarDe(hi);
    const condNome = hi.condominium?.name || "";
    const extras = [];
    if (c.taxaServico) extras.push(`taxa de serviço R$${c.taxaServico}`);
    if (c.seguro) extras.push(`seguro residencial R$${c.seguro}`);
    const custosTxt =
      `Custo mensal no portal: aluguel R$${c.rent} + condomínio R$${c.condo} + IPTU R$${c.iptu}` +
      (extras.length ? ` + ${extras.join(" + ")}` : "") +
      ` = R$${c.allIn}.`;
    const desc = [
      (hi.remarks || "").replace(/\s+/g, " ").trim(),
      condNome ? `Condomínio: ${condNome}.` : "",
      andar ? `${andar}.` : "",
      custosTxt,
    ]
      .filter(Boolean)
      .join(" ");

    itens.push({
      id: idDe(bairro, ruaFull, num(hi.area), id),
      title: `${hi.type} com ${num(hi.bedrooms)} quarto(s) para alugar em ${bairro}`.slice(0, 120),
      neighborhood: bairro,
      // O andar entra no endereço porque é ele que separa duas unidades do mesmo
      // prédio que o portal anuncia separadamente (ver `andarDe`).
      address: `${[ruaFull || bairro, andar].filter(Boolean).join(", ")}, ${bairro}, Curitiba - PR`,
      area: num(hi.area),
      bedrooms: num(hi.bedrooms),
      bathrooms: num(hi.bathrooms),
      parking: num(hi.parkingSpaces),
      rent: c.rent,
      condo: c.condo,
      iptu: c.iptu,
      // All-in de 5 termos: o total que o usuário paga. Atenção — merge.py
      // recalcula `total` como aluguel+condomínio+IPTU porque o schema Apartment
      // não tem campo para taxa de serviço nem seguro, então o número que o app
      // exibe fica ~4% abaixo do all-in real. A diferença está escrita na
      // descrição acima em vez de sumir.
      total: c.allIn,
      taxaServico: c.taxaServico,
      seguroResidencial: c.seguro,
      quintoAndarId: id,
      quintoAndarAnunciante: String(hi.displayId || ""),
      phone: tel,
      link: `${BASE_SITE}/imovel/${id}`,
      source: "QuintoAndar",
      features: comodidadesDe(hi),
      description: desc,
      photosCount: fotos.length,
      photoUrls: fotos,
      verifiedAt: HOJE,
    });
    est.passou++;
    console.log(
      `  + ${bairro} ${num(hi.area)}m2 ${num(hi.bedrooms)}qt R$${c.allIn} (alug ${c.rent} + cond ${c.condo} + iptu ${c.iptu} + taxa ${c.taxaServico} + seguro ${c.seguro}) fotos=${fotos.length}${tel ? ` tel=${tel}` : ""}`,
    );
  }

  const mot = [...est.motivos.entries()].map(([k, v]) => `${k}=${v}`).join(" ");
  console.log(
    `  [${alvo.nome}] ${est.passou}/${est.vettidos} passaram${mot ? ` — ${mot}` : ""}${est.repetidos ? ` (${est.repetidos} repetidos de outro slug)` : ""}\n`,
  );
}

// ---------------------------------------------------------------- relatório
// Nome do arquivo segue a convenção `<fonte>-<qts>q-ate<teto>-<n>b-l4.json`. Com
// o alvo default (quartos=2,3) sai `quinto-2q-ate3600-14b-l4.json`, que é o nome
// que merge.py recebe. O `q` é o MENOR quarto do alvo, como nas outras listas.
const qtsTxt = String(Math.min(...QTS_ALVO));
const arquivo = `${OUT}/quinto-${qtsTxt}q-ate${TETO_TOTAL}-${ALVOS.length}b-l4.json`;
writeFileSync(arquivo, JSON.stringify({ imoveis: itens }, null, 1), "utf8");

const comTel = itens.filter((x) => x.phone).length;
const pctTel = itens.length ? Math.round((comTel / itens.length) * 100) : 0;
console.log("=== por slug (ids no lote -> vettidos -> passou) ===");
for (const est of porSlug.values()) {
  console.log(
    `  ${String(est.ids).padStart(2)} -> ${String(est.vettidos).padStart(2)} -> ${String(est.passou).padStart(2)}  ${est.nome.padEnd(18)} ${[...est.motivos.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`,
  );
}
console.log(
  `\nTOTAL: ${itens.length} imóveis de ${vettidos} ids vettidos (${vettidos ? ((itens.length / vettidos) * 100).toFixed(1) : 0}%) | ${repetidos} ids repetidos entre slugs | descartados: ${descartados.length}`,
);
console.log(`tipos vistos: ${[...tiposVistos.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);
console.log(
  `delta dos 5 termos vs totalCost: ${[...deltas.entries()].map(([k, v]) => `${k}=${v}`).join(" ") || "nenhum imóvel lido"}`,
);
console.log(
  `esqueleto: ${esqueletoVezes} páginas vieram zeradas · ${esqueletoResolvidos} resolvidas no re-fetch · ${esqueletoPersistentes} seguiram depois de ${RETRY} tentativas`,
);
console.log(`telefone: ${comTel}/${itens.length} (${pctTel}%)`);
if (telefoneCaminhos.size) console.log(`  campos de contato com número no payload: ${[...telefoneCaminhos].join(" | ")}`);
else console.log("  varredura do payload: NENHUM campo de contato com telefone (medido, não assumido)");
if (itens.length && !comTel)
  console.warn(
    "  AVISO: zero telefone — medido no payload (AGENTS.md regra 2 reportada, não escondida). O número só sai com clique em 'mostrar telefone', que registra lead.",
  );

writeFileSync(
  `${OUT}/quinto-descartados-l4.json`,
  JSON.stringify(
    {
      resumo: Object.fromEntries(
        [...porSlug.values()].map((e) => [
          e.slug,
          {
            bairro: e.nome,
            ids: e.ids,
            vettidos: e.vettidos,
            passou: e.passou,
            mapa: e.mapa,
            repetidos: e.repetidos,
            motivos: Object.fromEntries(e.motivos),
          },
        ]),
      ),
      total: {
        ids: totalIds,
        vettidos,
        imoveis: itens.length,
        telefone: `${comTel}/${itens.length}`,
        telefoneMedido: false,
      },
      esqueleto: {
        vezes: esqueletoVezes,
        resolvidos: esqueletoResolvidos,
        persistentes: esqueletoPersistentes,
      },
      tipos: Object.fromEntries(tiposVistos),
      deltaAllIn: Object.fromEntries(deltas),
      descartados,
    },
    null,
    1,
  ),
  "utf8",
);
console.log(`>>> ${arquivo}`);
console.log(`>>> ${OUT}/quinto-descartados-l4.json`);
