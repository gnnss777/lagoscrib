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
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import {
  conectarSessaoLogada,
  extrairTelefone,
  leadConfigurado,
  preencherFormularioLead,
  telApolar,
} from "./telefone.mjs";

const DELAY = 8000; // mesmo ritmo do coleta.mjs (Cloudflare barra mais rápido)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (nome, padrao = "") => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit ? hit.split("=").slice(1).join("=") : padrao;
};
const CDPIA = arg("cdp");
const SO = arg("so");
const LIMITE = Number(arg("limite", "0")) || Infinity;

// Lead de formulário. Opt-in DUPLO: precisa de LEAD_ENABLED=true E das três
// variáveis preenchidas. Sem a flag, o backfill para no clique que revela
// direto e nunca chega a abrir o formulário — mesmo com dados no env.
const LEAD = leadConfigurado();
const USAR_LEAD = LEAD.habilitado && LEAD.completo;

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

console.log(
  USAR_LEAD
    ? `lead: ATIVO — vai enviar ${LEAD.dados.email} para cada anunciante sem telefone`
    : "lead: inativo — só coleta o que revela direto (LEAD_ENABLED=true + LEAD_* no env pra ativar)",
);

// Sem fallback para perfil novo: o perfil limpo devolveria zero telefone em
// silêncio. Se o Chromium logado (gnnss777 / Profile 1) não estiver de pé, o
// script para com a instrução de como subir.
const { ctx } = await conectarSessaoLogada(CDPIA);
console.log(`  [sessao] chromium logado conectado (perfil gnnss777)`);
const page = await ctx.newPage();

const pegaDoBrowser = [];
const semTelefone = [];
// Auditoria de lead: um registro por formulário ENVIADO. É o registro do que
// saiu do teu navegador para terceiros, então vai para o disco junto.
const enviados = [];
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
      continue;
    }
    // Sem número após o clique. Se o lead está ativo, o portal pode estar
    // pedindo formulário — tenta. Sem a flag, cai fora e o imóvel fica sem
    // telefone, que é o comportamento certo.
    if (USAR_LEAD) {
      const r = await preencherFormularioLead(page, LEAD.dados);
      if (r.ok) {
        // Auditoria: o que foi enviado, para quem, e o que voltou.
        enviados.push({ id, link, email: LEAD.dados.email, phone: r.phone, origem: "lead-form" });
        pegaDoBrowser.push({ id, link, phone: r.phone, celular: r.celular, fixo: r.fixo, origem: "lead-form" });
        console.log(`  [lead] ${id} ${r.phone}`);
      } else {
        semTelefone.push({ id, link, motivo: r.motivo });
        console.log(`  [lead-falhou] ${id} ${r.motivo}`);
      }
      continue;
    }
    semTelefone.push({ id, link, motivo: "sem botao mostrar telefone" });
    console.log(`  [--] ${id} sem telefone`);
  } catch (e) {
    semTelefone.push({ id, link, motivo: String(e).split("\n")[0].slice(0, 80) });
    console.log(`  [erro] ${id} ${String(e).split("\n")[0].slice(0, 70)}`);
  }
}

await page.close().catch(() => {});

const pct = base.length ? Math.round((pegaDoBrowser.length / base.length) * 100) : 0;
console.log(`\nRESULTADO: ${pegaDoBrowser.length}/${base.length} com telefone (${pct}%)`);
console.log(`  do disco (apolar):     ${pegaDoBrowser.filter((x) => x.origem === "apolar-api").length}`);
console.log(`  do portal (1 clique):  ${pegaDoBrowser.filter((x) => x.origem === "portal").length}`);
console.log(`  de formulario de lead: ${enviados.length}`);
console.log(`  sem telefone:          ${semTelefone.length}`);
if (enviados.length) {
  console.log(`\nLEADS ENVIADOS (${enviados.length}) — teu e-mail foi para:`);
  for (const e of enviados) console.log(`  ${e.id}  ${e.email}  -> ${e.phone}`);
}

writeFileSync(
  "data/coleta/telefones-backfill.json",
  JSON.stringify({ ok: pegaDoBrowser, sem: semTelefone, leadsEnviados: enviados }, null, 1),
  "utf8",
);
console.log("\ngravado: data/coleta/telefones-backfill.json");

// Sem isto o processo não encerra: connectOverCDP segura o websocket. Sai sem
// fechar o browser do usuário — os writes acima já estão no disco.
process.exit(0);
