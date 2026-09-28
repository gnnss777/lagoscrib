/**
 * Extração de campos a partir da página de UM anúncio, sem scraper por portal.
 *
 * Existe para o import por link: o usuário cola a URL de qualquer portal e o app
 * preenche o formulário. Não é um coletor de lote (isso é o `coleta.mjs`), então
 * aqui não há paginação, cota nem persistência — só ler uma página.
 *
 * Por que não reusar o `coleta.mjs`: ele executa a coleta no import e tem 800+
 * linhas. As 20 linhas de `num`/`money` foram reimplementadas aqui em vez de
 * extrair um módulo que os dois usariam — mexer num script que roda contra
 * portal real não se paga por 20 linhas.
 */
import { REGIONAL_GROUPS } from "@/lib/neighborhoods";

/** "1.234,56" -> 1235 · "45.5" -> 46 · "134" -> 134 */
export function num(v: unknown): number {
  if (v == null) return 0;
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3,}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Primeira ocorrência de "R$ 1.234" num texto -> 1234. */
export function money(txt: string | undefined | null): number {
  const m = (txt || "").match(/R\$\s*([\d.]{1,12}(?:,\d{1,2})?)/);
  return m ? num(m[1]) : 0;
}

export interface ImovelExtraido {
  title: string;
  neighborhood: string;
  address: string;
  area: number;
  /** De onde veio a área: a página, a URL, ou nada (0 = o usuário preenche). */
  areaFrom: "texto" | "url" | "nenhuma";
  bedrooms: number;
  bathrooms: number;
  parking: number;
  rent: number;
  condo: number;
  iptu: number;
  /** O portal diz explicitamente que não há condomínio, em vez de não informar. */
  condoUnknown: boolean;
  photoUrls: string[];
  /** Campos que a página não disse, para a UI avisar em vez de inventar valor. */
  avisos: string[];
}

function areaNoTexto(texto: string): number {
  const m = texto.match(/([\d.,]{1,7})\s*m\s*[²2]/i);
  return m ? num(m[1]) : 0;
}

/**
 * Bairro pelo nome oficial de lib/neighborhoods.ts. Ignora nomes curtos demais
 * para não casar palavra comum em texto corrido.
 *
 * Compara sem acento dos dois lados: slug de URL nunca tem ("agua-verde") e
 * portal varia ("Agua Verde" vs "Água Verde"), mas a lista oficial tem.
 */
export function bairroNoTexto(texto: string): string | null {
  if (!texto) return null;
  const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const t = " " + semAcento(texto).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ") + " ";
  let melhor: string | null = null;
  for (const grupo of REGIONAL_GROUPS) {
    for (const nome of grupo.neighborhoods) {
      const chave = semAcento(nome).toLowerCase();
      if (chave.length < 5) continue;
      if (!t.includes(" " + chave + " ")) continue;
      if (!melhor || nome.length > melhor.length) melhor = nome;
    }
  }
  return melhor;
}

/** Blocos ld+json da página, inclusive quando o Product está aninhado. */
function ldJson(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      out.push(...(Array.isArray(j) ? j : [j]));
    } catch {
      // JSON inválido é comum (vírgula final do portal). Ignora.
    }
  }
  const aninhados: Record<string, unknown>[] = [];
  for (const o of out) aninhados.push(...achata(o));
  return aninhados;
}

function achata(o: unknown, profundidade = 0): Record<string, unknown>[] {
  if (!o || typeof o !== "object" || profundidade > 3) return [];
  const r = o as Record<string, unknown>;
  const out: Record<string, unknown>[] = [];
  if (r["@type"]) out.push(r);
  for (const v of Object.values(r)) {
    if (Array.isArray(v)) v.forEach((x) => out.push(...achata(x, profundidade + 1)));
    else out.push(...achata(v, profundidade + 1));
  }
  return out;
}

function metas(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)="([^"]+)"[^>]+content="([^"]*)"/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

function textoVisivel(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

/**
 * Fotos do anúncio, com a grade do CDN reescrita quando o portal aceita.
 * O app exige lado maior >= 800px e lado menor >= 500px (audit-photos.mjs), e o
 * Chaves na Mão entrega 850x450 no link original — reprova. A grade faz parte do
 * path (/imn/<grade>/<resto>), então trocar por 1280x0853 devolve 1280x853 sem
 * converter nada: o portal já serve WebP.
 */
function fotosDoAnuncio(html: string, pagina: string): string[] {
  const candidatos = new Set<string>();
  for (const m of html.matchAll(/https:\/\/[^"'\\\s>]+\.(?:jpe?g|png|webp)/gi)) candidatos.add(m[0]);
  // O Chaves na Mão não tem extensão no path da galeria; casa pela pasta /imn/.
  for (const m of html.matchAll(/https:\/\/www\.chavesnamao\.com\.br\/imn\/[^"'\s>]+/g)) candidatos.add(m[0]);

  const daGrade = (u: string) => {
    const m = u.match(/^https:\/\/www\.chavesnamao\.com\.br\/imn\/\d+x\d+\/(.*)$/);
    return m ? `https://www.chavesnamao.com.br/imn/1280x0853/${m[1]}` : u;
  };

  return [...candidatos]
    .filter((u) => !/logo|icone|icon-|placeholder|sprite|banner|selo/i.test(u))
    .map(daGrade)
    .filter((u) => u !== pagina)
    .slice(0, 11);
}

/**
 * Lê uma página de anúncio. Não adivinha: o que a página não disser fica 0 e
 * vira aviso, para o usuário preencher no formulário (ADR-001 §4 — nunca
 * inventar valor).
 */
export function extrairDoAnuncio(html: string, url: string): ImovelExtraido {
  const texto = textoVisivel(html);
  const og = metas(html);
  const blocos = ldJson(html);
  const prod = blocos.find(
    (b) => b["@type"] === "Product" || b["@type"] === "Residence" || b["@type"] === "Apartment",
  );
  const desc = String(prod?.["description"] ?? og["og:description"] ?? "");

  const bairro =
    bairroNoTexto(og["og:title"] ?? "") ??
    bairroNoTexto(url) ??
    bairroNoTexto(desc) ??
    bairroNoTexto(texto.slice(0, 1500)) ??
    "";

  // Área: a página tem prioridade; a URL é o plano B (o Chaves na Mão esconde a
  // área atrás de um skeleton loader, então ela não existe no HTML).
  const areaTexto = areaNoTexto(texto) || areaNoTexto(desc);
  const areaUrl = num((url.match(/(\d{2,4})m2/i) || [])[1] ?? 0);
  const area = areaTexto || areaUrl;
  const areaFrom = areaTexto ? "texto" : areaUrl ? "url" : "nenhuma";

  // O match precisa PEGAR o preço: com `[^0-9]{0,30}` ele parava em "IPTU R$" e
  // money() não via o valor. Exige o R$ logo após a etiqueta (no máximo 20 chars
  // de distância), senão "IPTU isento, aluguel R$2.000" viraria 2.000.
  const semCondo = /sem\s+(taxa\s+)?(de\s+)?condom[íi]nio/i.test(texto);
  const linhaCondo = (texto.match(/[Cc]ondom[íi]nio[^0-9]{0,20}R\$\s*[\d.]+/i) || [])[0] ?? "";
  const condo = semCondo ? 0 : money(linhaCondo);
  const condoUnknown = !semCondo && !linhaCondo;

  const iptu = money((texto.match(/IPTU[^0-9]{0,20}R\$\s*[\d.]+/i) || [])[0]);

  // Endereço: o og:title é o texto que o portal montou para humanos
  // ("... na Rua Coronel Dulcídio, 357, Batel, Curitiba - PR"), então é mais
  // confiável que o texto corrido — lá o nome da rua aparece truncado.
  // GULOSO de propósito: com `{3,60}?` lazy e o sufixo do número opcional, o
  // regex parava no menor match e devolvia "Rua Cor".
  const reLogradouro =
    /(?:Rua|Avenida|Av\.|Alameda|Travessa|Estrada|Rodovia)\s[^,|]{3,60}(?:,\s*\d{1,5})?/;
  const address =
    ((og["og:title"] ?? "").match(reLogradouro)?.[0] ?? "").trim() ||
    (desc.match(reLogradouro)?.[0] ?? "").trim() ||
    (texto.match(reLogradouro)?.[0] ?? "").trim();

  const avisos: string[] = [];
  if (!bairro) avisos.push("bairro não identificado — preencha");
  if (areaFrom === "nenhuma") avisos.push("área não veio na página — preencha");
  if (areaFrom === "url") avisos.push(`área veio da URL (${area}m²), a página não mostra — confira`);
  if (condoUnknown) avisos.push("condomínio não informado na página");
  if (!og["og:image"] && !fotosDoAnuncio(html, url).length) avisos.push("nenhuma foto encontrada");

  return {
    title: (og["og:title"] ?? String(prod?.["name"] ?? "") ?? "").slice(0, 120) || "Imóvel importado",
    neighborhood: bairro,
    address,
    area,
    areaFrom,
    bedrooms: num((texto.match(/(\d+)\s*quarto/i) || [])[1] ?? 0),
    bathrooms: num((texto.match(/(\d+)\s*banheiro/i) || [])[1] ?? 0),
    parking: num((texto.match(/(\d+)\s*vaga/i) || [])[1] ?? 0),
    rent:
      money((texto.match(/[Vv]alor do aluguel[^\dR]{0,20}/) || [])[0]) ||
      money(desc) ||
      num(og["product:price:amount"] ?? 0),
    condo,
    iptu,
    condoUnknown,
    photoUrls: fotosDoAnuncio(html, url),
    avisos,
  };
}
