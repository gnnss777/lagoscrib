# Handoff OpenCode — lagoscrib backend multiusuário (LAG-2)

## Visão geral
Ativar backend multiusuário no app next.js (Vercel). Database: Neon Postgres (`quiet-truth-42958341/neondb`). Secrets no Vercel: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `VERCEL_TOKEN`, `NEON_API_KEY`.

## Fonte de verdade
- Repo: `C:\AI\apartamentos-app` (branch master, commit 06f5bf5)
- App: Next.js 16.3.5 + Prisma 7.10.0
- DB: Neon Postgres `quiet-truth-42958341/neondb`
- Auth local (modo legado) ativo — migrar para NextAuth → Prisma adapter
- Hobby Vercel BLOQUEIA deploy c/ autor out-of-project → usar `--prebuilt` p/ builds locais

## Tasklets (subagentes OpenCode, paralelos)

### T1 — Auth (NextAuth + Prisma adapter)
**Arquivos**: `lib/auth.ts`, `auth.config.ts`, `lib/prisma.ts`, `lib/db.ts`, `app/api/auth/[...nextauth]/route.ts`
- Auth apenas usuarios `guinness`/`curitiba2026` (seed)
- Adapter Prisma: `next-auth/prisma-adapter` — `@auth/prisma-adapter`
- Session JWT (sem DB session table)

### T2 — DB schema (users + sessions)
**Arquivos**: `prisma/schema.prisma`
- `User`, `Session`, `Account` (next-auth adapter) + `Apartment` já existe
- `npx prisma generate && prisma db push`

### T3 — API endpoints multiusuário
**Arquivos**: `app/api/apartments/route.ts`, `app/api/status/route.ts`
- Endpoint GET/POST que aceita `user_id` (session.nextauth)
- Filtra apartamentos por `user_id`

### T4 — QA + deploy
**Arquivos**: `.env.example`, `scripts/deploy.sh`
- Smoke test: login → lista filtrada → novo imóvel salva no usuário certo
- Deploy: `vercel pull --yes --environment production && vercel build --prod && vercel deploy --prebuilt --prod`

## Critérios de aceitação
- [ ] `npm run typecheck` verde
- [ ] `npm run build` verde (local)
- [ ] e2e: 20/20 passam
- [ ] Novo imóvel salvo com `user_id` do usuário logado
- [ ] Cross-user: imóvel de user A não aparece pro user B
- [ ] Deploy Vercel production verde

## Limites
- **NÃO** subir vídeos >5MB pro Vercel (regra Camilla/OP)
- NÃO hardcodear secrets — usar `process.env`
- Auth: só usuarios seed, sem signup público

## Modelo
`opencode/space-bunny-free` (free, smoke-tested SMOKE_OK)

## Dispatch
Paralelo — 4 subagentes T1/T2/T3/T4 no mesmo workdir (isolamento via branch).
