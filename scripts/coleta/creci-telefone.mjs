// Identidade do anunciante (imobiliária + CRECI) SEM clique e SEM lead.
//
// Precisa de browser porque a página é renderizada por JS: no HTML do servidor
// não vem o card da imobiliária nem o CRECI. Verificado 27/09/2026 — fetch puro
// devolve 0 identificações nos 39 anúncios; via browser dá nome, id, CRECI e o
// prefixo mascarado.
//
// O que sai de cada página, sem nenhuma interação:
//   - nome da imobiliária  a[href*="imobiliaria"]
//   - id no path          /imobiliaria/52572/
//   - CRECI               "00137-J-PR"
//   - prefixo mascarado   "(41) 3013-"  (conferência depois)
//   - "Anunciando desde"   quando aparece
//
// Zap e VivaReal compartilham o espaço de ids: 52572 = Gonzaga nos dois,
// 228024 = Cadena. Então os 39 anúncios colapsam em menos anunciantes, e
// resolver o celular de locação de UM anunciante resolve N anúncios.
//
// O telefone NÃO sai do portal sem clicar em "mostrar telefone" (registra lead)
// ou preencher formulário (manda dado pessoal). Sai do site da imobiliária, que
// é onde ela publica o contato de propósito.
//
// Uso: node scripts/coleta/creci-telefone.mjs --cdp=http://127.0.0.1:9222 [--limite=0] [--so=zap]
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const DELAY = 8000; // mesmo ritmo do coleta.mjs
const arg = (nome, padrao = "") => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit ? hit.split("=").slice(1).join("=") : padrao;
};
const CDPIA = arg("cdp");
const SO = arg("so");
const LIMITE = Number(arg("limite", "0")) || Infinity;

/** "00137-J-PR" / "06230-J-PR" / "J6230" -> "00137" / "06230" / "6230" */
export function creciNumerico(creci) {
  const m = String(creci ?? "").match(/(\d{3,6})\s*-?\s*J?\s*-?\s*PR/i);
  return m ? String(m[1]).padStart(4, "0") : "";
}

/** Id do anunciante no path: /imobiliaria/52572/ -> "52572" */
export function anuncianteId(url) {
  return String(url ?? "").match(/\/imobiliaria\/(\d+)/)?.[1] ?? "";
}

function baseAlvo() {
  // latin1: lib/data.ts é Windows-1252, não UTF-8 (ver ADR-004)
  const src = readFileSync("lib/data.ts", "latin1");
  const out = [];
  for (const bloco of src.split(/(\r?\n  \{\r?\n)/)) {
    if (!bloco.startsWith("    id: ")) continue;
    const id = bloco.match(/id:\s*"([^"]+)"/)?.[1];
    const link = bloco.match(/link:\s*"([^"]+)"/)?.[1];
    const phone = bloco.match(/phone:\s*"([^"]*)"/)?.[1];
    if (id && link) out.push({ id, link, phone });
  }
  return out;
}

if (!CDPIA) {
  console.error("ERRO: --cdp= obrigatório. A página é renderizada por JS; fetch puro não lê o card.");
  process.exit(1);
}

const base = baseAlvo().filter((x) => !x.phone && !x.id.startsWith("apolar-"));
const alvos = (SO ? base.filter((x) => x.id.startsWith(SO)) : base).slice(0, LIMITE);
console.log(`sem telefone e fora do apolar: ${base.length} | alvo: ${alvos.length}`);

const b = await chromium.connectOverCDP(CDPIA);
const ctx = b.contexts()[0];
if (!ctx) {
  console.error(`--cdp=${CDPIA} nao conectou.`);
  process.exit(1);
}
console.log(`  [cdp] conectado\n`);

// Lê só o que já está renderizado. NENHUM clique nesta função.
const LER = () => {
  const texto = document.body.innerText;
  const link = document.querySelector('a[href*="/imobiliaria/"]');
  return {
    imobiliaria: link ? (link.innerText || "").replace(/\s+/g, " ").trim() : "",
    imobiliariaUrl: link ? (link.getAttribute("href") || "").split("?")[0] : "",
    creci: (texto.match(/CRECI[:\s]*([A-Z0-9]{3,6}\s*-?\s*J?\s*-?\s*PR)/i) || [])[1] ?? "",
    telefoneMascarado: (texto.match(/\(41\)\s?[\d]{4}-/) || [])[0] ?? "",
    imoveisAnunciante: (texto.match(/(\d+)\s*im[oó]veis/i) || [])[1] ?? "",
    anunciandoDesde: (texto.match(/Anunciando desde\s*([^\n]{4,40})/i) || [])[1]?.trim() ?? "",
    temMostrarTelefone: /mostrar telefone/i.test(texto),
  };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const resultado = [];
let n = 0;
for (const item of alvos) {
  if (n++ >= LIMITE) break;
  const page = await ctx.newPage();
  const reg = { ...item };
  try {
    const st = await page.goto(item.link, { waitUntil: "domcontentloaded", timeout: 45000 });
    if ((st?.status() ?? 0) >= 400) {
      reg.erro = `HTTP ${st?.status()}`;
      console.log(`  [http] ${item.id} ${st?.status()}`);
      resultado.push(reg);
      continue;
    }
    await sleep(DELAY);
    const info = await page.evaluate(LER);
    Object.assign(reg, {
      imobiliaria: info.imobiliaria,
      imobiliariaUrl: info.imobiliariaUrl,
      anuncianteId: anuncianteId(info.imobiliariaUrl),
      creci: info.creci,
      creciNum: creciNumerico(info.creci),
      telefoneMascarado: info.telefoneMascarado,
      imoveisAnunciante: info.imoveisAnunciante,
      anunciandoDesde: info.anunciandoDesde,
    });
    console.log(
      `  [ok] ${item.id.padEnd(26)} ${(info.imobiliaria || "(sem nome)").padEnd(24)} creci=${(info.creci || "-").padEnd(12)} portal=${info.telefoneMascarado || "-"} ${info.imoveisAnunciante || "?"}im`,
    );
  } catch (e) {
    reg.erro = String(e).split("\n")[0].slice(0, 60);
    console.log(`  [erro] ${item.id} ${reg.erro}`);
  } finally {
    await page.close().catch(() => {});
    resultado.push(reg);
  }
}

const porAgencia = new Map();
for (const r of resultado) {
  const chave = r.anuncianteId || r.creciNum || r.imobiliaria;
  if (!chave) continue;
  if (!porAgencia.has(chave)) {
    porAgencia.set(chave, {
      chave,
      imobiliaria: r.imobiliaria,
      imobiliariaUrl: r.imobiliariaUrl,
      creci: r.creci,
      creciNum: r.creciNum,
      telefoneMascarado: r.telefoneMascarado,
      imoveisAnunciante: r.imoveisAnunciante,
      anunciandoDesde: r.anunciandoDesde,
      ids: [],
    });
  }
  porAgencia.get(chave).ids.push(r.id);
}

const anunciantes = [...porAgencia.values()].sort((a, b) => b.ids.length - a.ids.length);
console.log(`\n=== ${resultado.length} anuncios ===`);
console.log(`identificados: ${resultado.filter((r) => r.imobiliaria).length}`);
console.log(`sem nome:      ${resultado.filter((r) => !r.imobiliaria).length}`);
console.log(`\n=== ${anunciantes.length} anunciantes distintos ===`);
for (const g of anunciantes) {
  console.log(
    `  ${String(g.ids.length).padStart(2)} imoveis | ${(g.imobiliaria || "(sem nome)").padEnd(26)} | creci=${(g.creci || "-").padEnd(12)} | portal=${(g.telefoneMascarado || "-").padEnd(11)} | ${(g.imoveisAnunciante || "?").padStart(4)} im no portal`,
  );
}

writeFileSync(
  "data/coleta/creci-telefone.json",
  JSON.stringify({ anuncios: resultado, anunciantes }, null, 1),
  "utf8",
);
console.log("\ngravado: data/coleta/creci-telefone.json");
process.exit(0);
