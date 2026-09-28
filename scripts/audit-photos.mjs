// Auditoria programática das galerias S002 (leva dores-consumidor).
// Uso: node scripts/audit-photos.mjs
// Checker por diretório public/imoveis/<id>/: magic RIFF/WEBP (pega HTML/403),
// lado maior ≥ 800px e lado menor ≥ 500px (orientation-aware — retrato usa a
// altura como eixo; parse do header VP8/VP8L/VP8X, sem dependências),
// tamanho ≤ 350KB/arquivo, peso total ≤ 3,5MB, mínimo 8 fotos.
// Capas avulsas (public/imoveis/*.webp): magic + tamanho (sem regra de largura).
// Saída != 0 se qualquer checagem falhar.
//
// Auditoria só do que o app consome: os ids vêm de lib/data.ts. Fotos de imóveis
// que saíram da base são órfãs e ficam de fora do gate (não quebram o build, e
// continuam no disco caso a base volte). Use --tudo para auditar o diretório
// inteiro, inclusive órfãs.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// Regra orientation-aware (correção S002 pós-auditoria): o CDN entrega fit-in,
// então retrato tem largura < 800px por construção. O eixo que importa é o
// lado maior (viewer + zoom): lado maior ≥ 800px E lado menor ≥ 500px.
// (DESIGN.md §10 atualizado com a mesma regra.)
const ROOT = "public/imoveis";
const MIN_LONG_EDGE = 800;
const MIN_SHORT_EDGE = 500;
const MAX_FILE_BYTES = 350 * 1024;
const MAX_DIR_BYTES = 3.5 * 1024 * 1024;
const MIN_PHOTOS = 8;

function webpDims(buf) {
  if (buf.length < 30) return null;
  const four = (o) => String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || four(8) !== "WEBP") return null;
  const chunk = four(12);
  if (chunk === "VP8 ") {
    return {
      width: buf[26] | ((buf[27] & 0x3f) << 8),
      height: buf[28] | ((buf[29] & 0x3f) << 8),
    };
  }
  if (chunk === "VP8L") {
    const b = [buf[21], buf[22], buf[23], buf[24]];
    return {
      width: 1 + (((b[1] & 0x3f) << 8) | b[0]),
      height: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | (b[1] >> 6)),
    };
  }
  if (chunk === "VP8X") {
    const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
    const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
    return { width: w + 1, height: h + 1 };
  }
  return null;
}

let errors = 0;
const fail = (msg) => {
  errors++;
  console.log(`FAIL: ${msg}`);
};

// Ids que o app realmente consome (lib/data.ts). Sem --tudo, órfãs ficam de fora.
const auditarTudo = process.argv.includes("--tudo");
const idsDaBase = new Set(
  [...readFileSync("lib/data.ts", "utf8").matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]),
);
const naBase = (nome) => auditarTudo || idsDaBase.has(nome);

const entries = readdirSync(ROOT, { withFileTypes: true });
// Capas avulsas
for (const e of entries.filter((x) => x.isFile() && x.name.endsWith(".webp"))) {
  if (!naBase(e.name.replace(/\.webp$/, ""))) continue;
  const buf = readFileSync(join(ROOT, e.name));
  const dims = webpDims(buf);
  if (!dims) fail(`${e.name}: magic inválido (HTML/403?)`);
  else if (buf.length > MAX_FILE_BYTES) fail(`${e.name}: ${(buf.length / 1024).toFixed(0)}KB > 350KB`);
  else console.log(`ok capa ${e.name}: ${dims.width}x${dims.height}, ${(buf.length / 1024).toFixed(0)}KB`);
}
// Galerias
for (const e of entries.filter((x) => x.isDirectory())) {
  if (!naBase(e.name)) continue;
  const dir = join(ROOT, e.name);
  const files = readdirSync(dir).filter((f) => f.endsWith(".webp")).sort();
  let dirBytes = 0;
  // A galeria que o app mostra inclui a capa como primeira foto (photos[0] em
  // data.ts, via getGalleryPhotos). Ela conta no mínimo: sem isso, um imóvel
  // com 8 fotos no app é reprovado como se tivesse 7.
  const capa = join(ROOT, `${e.name}.webp`);
  let valid = existsSync(capa) && webpDims(readFileSync(capa)) ? 1 : 0;
  for (const f of files) {
    const p = join(dir, f);
    const buf = readFileSync(p);
    dirBytes += buf.length;
    const dims = webpDims(buf);
    if (!dims) {
      fail(`${e.name}/${f}: magic inválido (HTML/403?)`);
      continue;
    }
    const longEdge = Math.max(dims.width, dims.height);
    const shortEdge = Math.min(dims.width, dims.height);
    if (longEdge < MIN_LONG_EDGE || shortEdge < MIN_SHORT_EDGE)
      fail(`${e.name}/${f}: ${dims.width}x${dims.height}px (exige lado maior ≥ ${MIN_LONG_EDGE} e menor ≥ ${MIN_SHORT_EDGE})`);
    if (buf.length > MAX_FILE_BYTES)
      fail(`${e.name}/${f}: ${(buf.length / 1024).toFixed(0)}KB > 350KB`);
    valid++;
  }
  if (valid < MIN_PHOTOS) fail(`${e.name}: só ${valid} fotos válidas (< ${MIN_PHOTOS})`);
  if (dirBytes > MAX_DIR_BYTES)
    fail(`${e.name}: peso total ${(dirBytes / 1024 / 1024).toFixed(2)}MB > 3,5MB`);
  console.log(
    `ok galeria ${e.name}: ${valid} fotos, ${(dirBytes / 1024).toFixed(0)}KB total`
  );
}

const orfas = entries.filter(
  (x) => !naBase(x.isFile() ? x.name.replace(/\.webp$/, "") : x.name),
).length;
console.log(
  `\nbase: ${idsDaBase.size} imoveis | orfans fora da auditoria: ${orfas}${auditarTudo ? " (--tudo: auditando tudo)" : ""}`,
);
console.log(errors === 0 ? "--- auditoria PASS (0 erros) ---" : `--- auditoria FAIL (${errors} erros) ---`);
process.exitCode = errors === 0 ? 0 : 1;
