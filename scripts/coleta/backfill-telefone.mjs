// Backfill de telefone nos imóveis JÁ existentes em lib/data.ts.
//
// Por que isto existe: `generate.py` pula id que já está em lib/data.ts (ele só
// APPENDA), então rodar a coleta de novo nunca preenche o telefone dos 64
// imóveis que já estão na base. Sem isto, o coletor sóMANDaria telefone para
// imóvel novo e a base ficaria com telefone só nos próximos.
//
// Também não depende da busca por listagem: entra pelos links que já estão
// salvos. A busca de listagem do Zap está limitada (o mercado de 2 quartos a
// R$ 3.500 all-in nos bairros prioritários está esgotado — S010) e falha em
// silêncio, que é o pior jeito de falhar (postmortem ERRO-2).
//
// Uso: node scripts/coleta/backfill-telefone.mjs [--cdp=http://127.0.0.1:9222] [--so=zap]
//
// Clicar "mostrar telefone" REGISTRA LEAD no painel do anunciante. Uma passada
// = um clique por imóvel, no ritmo do DELAY. Rode quando quiser, não é urgency.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { extrairTelefone, telApolar } from "./telefone.mjs";

const DELAY = 8000; // mesmo ritmo do coleta.mjs (Cloudflare barra mais rápido)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (nome, padrao = "") => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit ? hit.split("=").slice(1).join("=") : padrao;
};
const CDPIA = arg("cdp");
const SO = arg("so");
const LIMITE = Number(arg("limite", "0")) || Infinity;

// Lê os pares { id, link } direto do array gerado em lib/data.ts, sem
// importar TypeScript. Regex: só o `id:` e o `link:` de cada entrada, na ordem
// em que aparecem no arquivo.
function idsELinksDaBase() {
  const src = readFileSync("lib/data.ts", "utf8");
  const out = [];
  const re = /id:\s*"([^"]+)"[\s\S]{0,4000}?link:\s*"([^"]+)"/g;
  for (const m of src.matchAll(re)) out.push({ id: m[1], link: m[2] });
  return out;
}

// Telefone que o Apolar já devolveu na API e ficou gravado no JSON da leva.
// Sem browser: alguns imóveis da base são do Apolar, e o número está no disco.
function telefonesDoApolarNoDisco() {
  const mapa = new Map();
  const dir = "data/coleta";
  let arquivos = [];
  try {
    arquivos = readdirSync(dir).filter((f) => /^apolar.*\.json$/.test(f));
  } catch {
    return mapa;
  }
  for (const f of arquivos) {
    let j;
    try {
      j = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
    } catch {
      continue;
    }
    for (const x of j.imoveis ?? []) {
      const tel = telApolar(x.lojacelular) || telApolar(x.lojatelefone);
      // nome do anúncio também vira chave: o id do app tem outro formato
      if (tel) mapa.set(x.id, tel);
      if (tel && x.link) mapa.set(x.link, tel);
    }
  }
  return mapa;
}

const base = idsELinksDaBase();
console.log(`base: ${base.length} imóveis`);

const doDisco = telefonesDoApolarNoDisco();
console.log(`apolar no disco: ${doDisco.size} chaves`);

if (!CDPIA) {
  console.error("ERRO: --cdp= é obrigatório. O telefone do Zap/VivaReal só sai de um browser logado.");
  process.exit(1);
}

const browser = await chromium.connectOverCDP(CDPIA);
const ctx = browser.contexts()[0];
if (!ctx) {
  console.error(`--cdp=${CDPIA} nao conectou.`);
  process.exit(1);
}
console.log(`  [cdp] conectado em ${CDPIA}`);
const page = await ctx.newPage();

const pegaDoBrowser = [];
const semTelefone = [];
let n = 0;

for (const { id, link } of base) {
  if (n++ >= LIMITE) break;
  if (SO && !id.startsWith(SO)) continue;

  // 1. tenta o disco primeiro (Apolar): zero clique, zero lead.
  const doDiscoTel = doDisco.get(id) || doDisco.get(link);
  if (doDiscoTel) {
    pegaDoBrowser.push({ id, link, phone: doDiscoTel, origem: "apolar-api" });
    console.log(`  [disco] ${id} ${doDiscoTel}`);
    continue;
  }

  // 2. portal (Zap/VivaReal/OLX): precisa do clique.
  try {
    const st = await page.goto(link, { waitUntil: "domcontentloaded", timeout: 45000 });
    if ((st?.status() ?? 0) >= 400) {
      semTelefone.push({ id, link, motivo: `HTTP ${st?.status()}` });
      console.log(`  [http] ${id} ${st?.status()}`);
      continue;
    }
    await sleep(DELAY);
    const t = await extrairTelefone(page);
    if (t) {
      pegaDoBrowser.push({ id, link, phone: t.phone, celular: t.celular, fixo: t.fixo, origem: "portal" });
      console.log(`  [ok] ${id} ${t.phone}`);
    } else {
      semTelefone.push({ id, link, motivo: "sem botao mostrar telefone" });
      console.log(`  [--] ${id} sem telefone`);
    }
  } catch (e) {
    semTelefone.push({ id, link, motivo: String(e).split("\n")[0].slice(0, 80) });
    console.log(`  [erro] ${id} ${String(e).split("\n")[0].slice(0, 70)}`);
  }
}

await page.close().catch(() => {});

const pct = base.length ? Math.round((pegaDoBrowser.length / base.length) * 100) : 0;
console.log(`\nRESULTADO: ${pegaDoBrowser.length}/${base.length} com telefone (${pct}%)`);
console.log(`  do disco (apolar): ${pegaDoBrowser.filter((x) => x.origem === "apolar-api").length}`);
console.log(`  do portal (1 clique cada): ${pegaDoBrowser.filter((x) => x.origem === "portal").length}`);
console.log(`  sem telefone: ${semTelefone.length}`);

writeFileSync("data/coleta/telefones-backfill.json", JSON.stringify({ ok: pegaDoBrowser, sem: semTelefone }, null, 1), "utf8");
console.log("gravado: data/coleta/telefones-backfill.json");
console.log("proximo passo: python data/coleta/aplicar-telefones.py");

// Sem isto o processo não encerra: connectOverCDP segura o websocket. Sai sem
// fechar o browser do usuário — os writes acima já estão no disco.
process.exit(0);
