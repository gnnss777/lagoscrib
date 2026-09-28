// Aplica o telefone da imobiliária nos imóveis da base.
//
// Fonte do número: o site da própria imobiliária (data/coleta/imobiliarias-telefone.json),
// conferindo CRECI do site contra CRECI do anúncio. Nenhum clique em portal,
// nenhum lead, nenhum dado pessoal.
//
// Regra do dono: só CELULAR de DDD 41 (região Curitiba). Fixo fica de fora do
// `phone` e vai para o log — o app mostra o link do anúncio nesse caso.
//
// Aplica por bloco de entrada em lib/data.ts. lib/data.ts é Windows-1252
// (latin1) e CRLF; ver ADR-004. Erro de encoding aqui corrompe a base inteira.
import { readFileSync, writeFileSync } from "node:fs";
import { ehCelular, ehDoDdd, ehFixo } from "./telefone.mjs";

const LER = "latin1";

const mapa = JSON.parse(readFileSync("data/coleta/imobiliarias-telefone.json", "utf8"));
const ident = JSON.parse(readFileSync("data/coleta/creci-telefone.json", "utf8"));

// Tudo chaveado por NOME da imobiliaria, nunca pelo indice `n`. O `n` e a
// posicao na lista de anunciantes, e essa lista e reordenada a cada nova leva —
// indexar por ele ja fez o apply silenciosamente errar uma vez. Nome de
// imobiliaria e estavel.
const porNome = new Map();
const rejeitados = [];
for (const a of mapa.anunciantes) {
  const cel = a.celular && ehCelular(a.celular) && ehDoDdd(a.celular) ? a.celular : null;
  const fix = a.fixo && ehFixo(a.fixo) && ehDoDdd(a.fixo) ? a.fixo : null;
  if (a.celular && !cel)
    rejeitados.push({
      n: a.n,
      nome: a.nome,
      motivo: `celular "${a.celular}" não passa na validação (DDD 41 ou nono dígito)`,
      nota: a.nota,
    });
  porNome.set(a.nome, { celular: cel, fixo: fix, nome: a.nome, site: a.site, creci: a.creci });
}

const src = readFileSync("lib/data.ts", LER);
const SEP_RE = /(\r?\n  \{\r?\n)/;
const partes = src.split(SEP_RE);

let celPreenchidos = 0;
let jaTinham = 0;
const semCelular = [];
const aplicados = [];

for (let i = 2; i < partes.length; i += 2) {
  const bloco = partes[i];
  if (/phone:\s*"\+/.test(bloco)) {
    jaTinham++;
    continue; // anti-apagão
  }
  const id = bloco.match(/id:\s*"([^"]+)"/)?.[1];
  if (!id) continue;
  // imobiliaria do anúncio: salva no creci-telefone.json, gerado sem clique
  const anunciante = ident.anunciantes.find((g) => g.ids.includes(id));
  if (!anunciante?.imobiliaria) continue;
  const t = porNome.get(anunciante.imobiliaria);
  if (!t) continue;
  if (!t.celular) {
    semCelular.push({ id, imobiliaria: t.nome, fixo: t.fixo ?? "" });
    continue;
  }
  partes[i] = bloco.replace(/phone:\s*"[^"]*"/, () => `phone: "${t.celular}"`);
  celPreenchidos++;
  aplicados.push({
    id,
    imobiliaria: t.nome,
    phone: t.celular,
    site: t.site,
    creci: t.creci,
    creciAnuncio: anunciante.creci || "",
  });
}

writeFileSync("lib/data.ts", partes.join(""), LER);

// relatório
const porAgencia = new Map();
for (const a of aplicados) {
  if (!porAgencia.has(a.imobiliaria)) porAgencia.set(a.imobiliaria, { ...a, n: 0 });
  porAgencia.get(a.imobiliaria).n++;
}
console.log(`celulares aplicados: ${celPreenchidos} imoveis de ${porAgencia.size} imobiliarias`);
console.log(`ja tinham telefone:  ${jaTinham} (apolar)`);
console.log(`ficaram sem celular: ${semCelular.length} imoveis`);

console.log(`\n=== por imobiliaria ===`);
for (const [nome, a] of [...porAgencia].sort((x, y) => y[1].n - x[1].n)) {
  console.log(`  ${String(a.n).padStart(2)} imoveis | ${a.phone} | ${nome.padEnd(26)} | creci=${a.creci || "-"}`);
}

if (semCelular.length) {
  console.log(`\n=== sem celular (fixo existe, mas fora do requisito) ===`);
  for (const s of semCelular) {
    console.log(`  ${s.id.padEnd(26)} ${s.imobiliaria.padEnd(26)} fixo=${s.fixo || "(nenhum)"}`);
  }
}

console.log(`\n=== rejeitados na validacao ===`);
for (const r of rejeitados) console.log(`  #${r.n} ${r.nome}: ${r.motivo}`);
console.log(`\n=== nao resolvidos (${mapa.naoResolvidos.length}) ===`);
for (const n of mapa.naoResolvidos) console.log(`  #${n.n} ${n.nome} — ${n.motivo}`);

writeFileSync(
  "data/coleta/imobiliarias-aplicado.json",
  JSON.stringify(
    { aplicados, semCelular, rejeitados, naoResolvidos: mapa.naoResolvidos },
    null,
    1,
  ),
  "utf8",
);
console.log("\ngravado: data/coleta/imobiliarias-aplicado.json");
