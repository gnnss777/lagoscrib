// Base de imóveis do PERFIL ATIVO do deploy (ver next.config.js).
//
// O app consome SEMPRE "@/lib/base" em vez de "@/lib/data" direto, para que só
// uma das bases entre no bundle. next.config.js troca o destino do alias com a
// env pública NEXT_PUBLIC_PERFIL (ou NEXT_PUBLIC_BASE_ARQUIVO), que é a chave do
// perfil em perfis.json:
//
//   "thais"  -> lib/data-thais.ts  (Chaves na Mão, 3+ quartos, teto R$ 8.000)
//   ausente  -> este arquivo      -> lib/data.ts (dono, 2-3 quartos, R$ 3.600)
//
// Escolha por alias e não por `cond ? baseA : baseB` no pool porque o Next.js
// só embute `process.env.NEXT_PUBLIC_*` no bundle do cliente quando a variável
// EXISTE. Sem a env (deploy do dono) o ternário não vira constante em tempo de
// build, as DUAS bases iam parar no bundle, e o grep do dono acharia ids da
// Thaís. Com alias, a base do outro perfil nunca entra no grafo de módulos.
//
// Este arquivo existe para o TypeScript e o vitest (que não leem o
// next.config.js) resolverem o import; em build ele é substituído pelo alias.
//
// Só o DADO muda. O schema é o mesmo nas duas bases geradas, então o tipo
// `Apartment` continua vindo de "@/lib/data" e os ~15 arquivos que importam
// apenas o tipo não mudam.
export { apartments, saleApartments } from "@/lib/data";
