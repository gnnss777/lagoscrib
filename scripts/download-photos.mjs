// Downloader da coleta S002 (leva dores-consumidor, LL-045/046).
// Uso: node scripts/download-photos.mjs coleta/urls-leva1.json
// - Referer + UA desktop (CDN do Zap exige — LL-046), delay entre requests,
//   retry com backoff, pula arquivos já válidos (RIFF/WEBP).
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname } from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const REFERER = "https://www.zapimoveis.com.br/";
const RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function looksWebp(buf) {
  return (
    buf.length > 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  );
}

async function fetchOnce(url) {
  const res = await fetch(url, { headers: { Referer: REFERER, "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!looksWebp(buf)) throw new Error(`bytes inválidos (${buf.length}b, sem magic RIFF/WEBP)`);
  return buf;
}

async function main() {
  const listFile = process.argv[2];
  if (!listFile) throw new Error("uso: node scripts/download-photos.mjs <lista.json>");
  const list = JSON.parse(readFileSync(listFile, "utf8"));
  const delay = list.delayMs ?? 2500;
  let ok = 0;
  let fail = 0;
  for (const item of list.items) {
    if (existsSync(item.file) && looksWebp(readFileSync(item.file))) {
      console.log(`SKIP (válido): ${item.file}`);
      ok++;
      continue;
    }
    mkdirSync(dirname(item.file), { recursive: true });
    let done = false;
    for (let attempt = 1; attempt <= RETRIES && !done; attempt++) {
      try {
        const buf = await fetchOnce(item.url);
        writeFileSync(item.file, buf);
        console.log(`OK (${buf.length}b): ${item.file}`);
        ok++;
        done = true;
      } catch (err) {
        console.log(`TRY ${attempt}/${RETRIES} falhou ${item.file}: ${err.message}`);
        await sleep(delay * attempt); // backoff
      }
    }
    if (!done) {
      fail++;
      console.log(`FAIL: ${item.file}`);
    }
    await sleep(delay);
  }
  console.log(`--- fim: ${ok} ok, ${fail} falhas ---`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
