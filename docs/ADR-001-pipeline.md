# ADR-001 — Pipeline de dados: JSON versionado, coleta curada

Data: 2026-09-22. Status: aceita (fork `feat/dados-reais`).

## Contexto
O app lê `lib/data.ts` estático. A EVIDENCIA-VALIDACAO mostra dados simulados.
A pesquisa real (MOC Imoveis no vault, sessão 22/09/2026) produz anúncios verificados
que precisam alimentar o app sem quebrar determinismo nem revisabilidade.

## Decisão
1. Fonte de verdade do app = `lib/data.ts` versionado em git (determinístico).
2. Novas levas de pesquisa entram via PR semanal curado (humano revisa preço/link/fotos),
   nunca por fetch automático em runtime.
3. Coleta usa browser real com delay (Zap/OLX bloqueiam fetch datacenter — LL-045),
   normaliza para o schema do app (`id, title, neighborhood, address, area, bedrooms,
   bathrooms, parking, rent, condo, iptu, total, phone, email, link, image,
   features[], description, source?, zapId?, condoUnknown?`).
4. `total` = aluguel líquido (pós-bonificação) + condomínio + IPTU. Condomínio
   desconhecido = `condo: 0 + condoUnknown: true` + flag em `features` — nunca inventar valor.
5. Contato sempre pelo `link` do anúncio original (banco de links). Telefone/e-mail
   mascarados nos portais => campos vazios, UI esconde os botões.

## Consequências
- Build e testes determinísticos; cada leva de dados é um diff revisável.
- Coletor automático em runtime fica para leva futura (exige backend + anti-bot + dedup).
- Auth continua client-side/localStorage nesta leva (ver README: `.env.local`).

## Alternativas rejeitadas
- Fetch em runtime no client: bloqueado por Cloudflare/rate-limit, quebra o app.
- Backend + Supabase agora: fora do escopo da leva (decisão do cliente, 22/09/2026).

## Status
Aceita. Em vigor desde 2026-09-22 (branch `feat/dados-reais`, commit `48da29d`).
Retrofit formal em 2026-09-22 (F0′ da leva dores-consumidor) — nenhuma decisão alterada.

## ADR Dependencies
Nenhuma (primeiro ADR do projeto). ADR-002 (UI de confiança da leva dores-consumidor)
depende deste: estende o schema aqui definido de forma aditiva.

## Engine Compatibility
Next.js 16 (App Router) · domínio Data/UI · risk LOW — schema é TypeScript estático
versionado em git; nenhuma API instável do framework envolvida. Regra AGENTS.md:
`node_modules/next/dist/docs/` consultado antes de qualquer mudança de schema.

## GDD Requirements Addressed
- `DESIGN.md` §7 (Guidelines): "contato sempre pelo link original", "sem dados inventados
  (`condoUnknown` + flag)", "valores com fonte em `lib/constants.ts`".
- Plano `lagoscrib-update-dores-consumidor` F1/F2: coleta curada 2 levas, manifesto de fotos,
  links validados, sem inventar valores/planta.

## Validation Criteria
- [x] `lib/data.ts` compila (`tsc --noEmit`) e `npm run build` verdes.
- [x] 7 imóveis de aluguel com `verifiedAt`, `link` https válido e `image` local.
- [x] `data/apartamentos.simulados.json` intacto (dados antigos preservados, só append).
- [x] Suite F0′ verde: `tests/unit/smoke.test.ts` + `e2e/smoke.spec.ts` (login + 7 cards).
