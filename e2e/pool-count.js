// Contagem REAL do pool estático (sem rodar TS): lê lib/data.ts, conta
// objetos por id, separa venda (transaction: "venda") do resto (aluguel —
// default do pool). Fonte da verdade pros e2e de contagem de cards.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "lib", "data.ts");
const ts = fs.readFileSync(file, "utf8");

// Cada imóvel aparece como `    id: "..."` (4 espaços de indentação no export default).
const total = (ts.match(/^[ ]{4}id: "[^"]+"/gm) || []).length;
const sale = (ts.match(/transaction: "venda"/g) || []).length;

module.exports = { total, rent: total - sale };
