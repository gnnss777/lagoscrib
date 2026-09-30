const PERFIS = require("./data/coleta/perfis.json");

// Perfil do deploy: NEXT_PUBLIC_PERFIL (ou NEXT_PUBLIC_BASE_ARQUIVO) é o nome de
// um perfil em data/coleta/perfis.json ("thais", "dono"). Sem env — ou com nome
// desconhecido — vale perfis.default: o dono, que é o comportamento de sempre.
// Dois nomes porque a env diz QUAL base, e o app já tem uma env pública que
// escolhe comportamento em build (NEXT_PUBLIC_OPEN_ACCESS): o prefixo
// NEXT_PUBLIC_ é obrigatório aqui, senão o valor não entra no bundle do client.
// String(...) normaliza: o nome do perfil não entra em nada como chave sem
// virar string antes.
const PERFIL = String(
  process.env.NEXT_PUBLIC_PERFIL ?? process.env.NEXT_PUBLIC_BASE_ARQUIVO ?? PERFIS.default,
);
const perfil = PERFIS.perfis[PERFIL] ?? PERFIS.perfis[PERFIS.default];

// O app consome "@/lib/base" (ver lib/base.ts) e este alias aponta para o
// arquivo da base do perfil. Escolher o módulo aqui, e não com um ternário em
// lib/pool.ts, é o que garante que a base do OUTRO perfil não entre no bundle:
// o Next.js só embute process.env.NEXT_PUBLIC_* no cliente quando a variável
// EXISTE, então sem a env (deploy do dono) um ternário não vira constante em
// tempo de build e as duas bases iam ser empacotadas.
const BASE_ARQUIVO = `./${perfil.data}`;

// Recibo no log do build: qual base entrou no bundle.
console.log(`[base] perfil=${PERFIL} -> ${BASE_ARQUIVO}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "img.olx.com.br" },
      { protocol: "https", hostname: "vivaimagem.vivareal.com.br" },
    ],
  },
  turbopack: {
    resolveAlias: { "@/lib/base": BASE_ARQUIVO },
  },
};

module.exports = nextConfig;
