// Telefone dos imóveis do Apolar, direto da API pública.
//
// Sem browser, sem clique, sem formulário, sem lead. A API de busca (a mesma que
// coleta.mjs já consome) devolve `lojacelular`/`lojatelefone` preenchidos em
// 100% dos anúncios — verificado em 27/09/2026: 200/200. Só que ninguém lia o
// campo: estava em APOLAR_FIELDS desde sempre e o mapping nunca referenciou
// (ADR-004).
//
// Uso: node scripts/coleta/apolar-telefone.mjs
//
// E-mail NÃO existe: nenhum dos 4 portais publica e-mail do anunciante.
import { readFileSync, writeFileSync } from "node:fs";
import { telApolar } from "./telefone.mjs";

// lib/data.ts NÃO é UTF-8: é Windows-1252 ("VivaReal · 211095", "Lançamentos").
// Ler como "utf8" troca cada byte inválido por U+FFFD e escrever de volta
// corrompe o arquivo inteiro. "latin1" faz round-trip byte a byte, então o que
// não é tocado sai idêntico.
const LER = "latin1";

const API = "https://uiyek91vqe.execute-api.us-east-1.amazonaws.com/prod/properties/search/main";
const FIELDS = ["referencia", "bairro", "loja", "lojacelular", "lojatelefone"];

// 1. refs do Apolar que já estão na base
const src = readFileSync("lib/data.ts", LER);
const refs = [...new Set([...src.matchAll(/apolarId:\s*"(\d+)"/g)].map((m) => m[1]))];
console.log(`apolarId na base: ${refs.length}`);

// 2. uma chamada por ref (a API filtra por `reference`)
const telefonePorRef = new Map();
const lojaPorRef = new Map();
let erro = 0;
for (const ref of refs) {
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        business: "Locacao",
        business_subfilter: "",
        reference: ref,
        city: "Curitiba",
        country: "Brasil",
        district: [],
        property_type: ["Apartamento"],
        property_type_combo: [],
        bedrooms: [],
        garage: [],
        bathrooms: [],
        price_max: "R$ 3.500,00",
        price_min: "R$ 0,00",
        area_max: "0,00 m²",
        area_min: "0,00 m²",
        address: null,
        address_number: null,
        open_search: "",
        in_condominium: false,
        include_condominium_price: false,
        conveniences: [],
        recreation: [],
        facilities: [],
        rooms: [],
        idLoja: null,
        use_scroll: true,
        showStoreImmobiles: true,
        order: "price_asc",
        size: 10,
        fields: FIELDS,
        price: [0, 0],
        area: [0, 0],
      }),
    });
    const lote = (await r.json())?.data ?? [];
    const x = lote.find((y) => String(y.referencia) === ref) ?? lote[0];
    if (!x) continue;
    const tel = telApolar(x.lojacelular) || telApolar(x.lojatelefone);
    if (tel) {
      telefonePorRef.set(ref, tel);
      if (x.loja) lojaPorRef.set(ref, x.loja);
    }
  } catch (e) {
    erro++;
    console.log(`  [erro] ${ref} ${String(e).split("\n")[0].slice(0, 50)}`);
  }
}
console.log(`API: ${telefonePorRef.size}/${refs.length} com telefone (${erro} erro)`);

// 3. patch no lib/data.ts, entrada por entrada. Anti-apagão: só preenche phone
//    vazio, nunca sobrescreve um telefone que já exista.
//
// Três armadilhas já mordidas aqui, todas comentadas para não repetir:
//
// a) NÃO usar regex atravessando linhas. `phone:` vem ANTES de `apolarId:` no
//    objeto, então "apolarId[\s\S]{0,4000}?phone:" casa com a entrada SEGUINTE
//    e patcha o imóvel errado — e quebra o arquivo.
//
// b) O split usa GRUPO CAPTURADO de propósito: String.split reinsere o grupo no
//    resultado, então os separadores voltam intactos. NÃO usar `join(SEP)` —
//    join() converte o RegExp em String e escreve o texto literal
//    "/\r?\n  \{\r?\n/" no meio do arquivo. Isso aconteceu.
//
// c) O arquivo é CRLF inteiro (2367 CRLF, 0 LF puro), daí o \r?.
const SEP_RE = /(\r?\n  \{\r?\n)/;
const partes = src.split(SEP_RE);
// índices: 0 = cabeçalho, 1 = separador, 2 = entrada 1, 3 = separador, ...
let preenchidos = 0;
let jaTinham = 0;
for (let i = 2; i < partes.length; i += 2) {
  const bloco = partes[i];
  const m = bloco.match(/apolarId:\s*"(\d+)"/);
  if (!m) continue;
  const tel = telefonePorRef.get(m[1]);
  if (!tel) continue;
  if (/phone:\s*"\+/.test(bloco)) {
    jaTinham++;
    continue;
  }
  if (!/phone:\s*"[^"]*"/.test(bloco)) continue;
  // função no replace: evita que $&, $1 etc. no número sejam interpretados
  partes[i] = bloco.replace(/phone:\s*"[^"]*"/, () => `phone: "${tel}"`);
  preenchidos++;
}
const out = partes.join("");

const restantes = refs.length - telefonePorRef.size;
const pct = refs.length ? Math.round((telefonePorRef.size / refs.length) * 100) : 0;
if (preenchidos) writeFileSync("lib/data.ts", out, LER);
console.log(`\nlib/data.ts: ${preenchidos} preenchidos, ${jaTinham} ja tinham, ${restantes} sem telefone na API`);
console.log(`cobertura apolar: ${telefonePorRef.size}/${refs.length} (${pct}%)`);

const lojas = [...new Set(lojaPorRef.values())];
if (lojas.length) console.log(`imobiliarias: ${lojas.join(" | ")}`);
