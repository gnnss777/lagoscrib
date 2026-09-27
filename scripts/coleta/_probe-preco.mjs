// Descobrir o parametro de preco na URL de busca do Zap/VivaReal.
// Criterio: se a busca com teto R$ 3.000 devolver cards com aluguel abaixo disso,
// o parametro funcionou.
import { chromium } from "@playwright/test";

const PROFILE = "C:/Users/gnnss/AppData/Local/Temp/coleta-edge-profile";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BASE = "https://www.zapimoveis.com.br/aluguel/apartamentos/pr+curitiba/?quartos=2,3";
const CANDIDATOS = [
  "precoMax=3000",
  "precoMaximo=3000",
  "valorMax=3000",
  "precoMaximo=3000&precoMinimo=0",
  "preco=0-3000",
  "faixaPreco=0-3000",
];

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: "msedge",
  headless: false,
  userAgent: UA,
  locale: "pt-BR",
  viewport: { width: 1440, height: 900 },
  args: ["--disable-blink-features=AutomationControlled"],
  ignoreDefaultArgs: ["--enable-automation"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

async function precosCards() {
  return page.evaluate(() => {
    const txt = document.body.innerText;
    const vals = [...txt.matchAll(/R\$\s*([\d.]{3,12}(?:,\d{2})?)/g)].map((m) =>
      Number(m[1].replace(/\./g, "").replace(",", ".")),
    );
    const cards = [...document.querySelectorAll("a[href*='/imovel/']")];
    return { total: vals.length, acima3000: vals.filter((v) => v > 3000).length, cards: cards.length };
  });
}

for (const q of CANDIDATOS) {
  const r = await page.goto(`${BASE}&${q}`, { waitUntil: "domcontentloaded", timeout: 50000 });
  await sleep(6000);
  const s = await precosCards();
  console.log(
    `${r?.status()} cards=${String(s.cards).padStart(2)} precos=${String(s.total).padStart(3)} acima3000=${String(s.acima3000).padStart(3)} :: ${q}`,
  );
  await sleep(8000);
}
await ctx.close();
