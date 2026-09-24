# Handoff — Kanban v2: dash↔board, soft-delete e DnD sem multiplicação (LAG-2.5)

- **Data:** 2026-09-24
- **Projeto:** lagoscrib (`C:\AI\apartamentos-app`), master `c20d222a`
- **Modelo:** `opencode/space-bunny-free` (worktrees: oc-auth/oc-db/oc-api/oc-qa, já sincronizadas com master)
- **Tags:** `#sdd #handoff #audit`

## 1. Resumo

O usuário reporta **cards duplicando ao mover entre colunas**. Diagnóstico localizado: o KanbanBoard sintetiza uma entrada "novo" para TODO imóvel do pool (109) e o AppContext mantém **duas fontes de imóveis** (`data.ts` estático + localStorage `apartamentos-app-new`), então o mesmo imóvel entra duas vezes na lista `apartments` que alimenta `columns`. Ao mover, `moveCard` cria a entrada de destino e a fonte duplicada recria a antiga → parece multiplicação. Além disso, o usuário definiu o fluxo alvo Dashboard↔Kanban (soft-delete + status tab) que não existe hoje.

**Tudo deve permanecer funcionando em modo legado (localStorage) quando não há backend.**

## 2. Estado atual (verificado em código)

- `lib/kanban.ts:190 moveCard()` — imutável, remove a entrada antiga antes de inserir (`prev.filter(e => e.apartmentId !== apartmentId)`). A função em si está correta.
- `KanbanBoard.tsx:148-161` — `columns = apartments.map(a => statuses.find(...) ?? {status:"novo", index: MAX})`: todo imóvel sem status vira card na coluna "novo".
- `AppContext.tsx:113-145` — statuses em `localStorage` (`STORAGE_KEY`); `AppContext.tsx:175-195` — imóveis adicionados manualmente em `localStorage "apartamentos-app-new"`. O pool final concatena estático + novos.
- `lib/constants.ts:171-172` — `REMOVED_IDS_STORAGE_KEY` já existe (soft-delete visual já esboçado no front para ids `new-*`).
- Dashboard é a página principal (`app/components/Dashboard.tsx`) com todos os imóveis; kanban é outra view.
- Backend LAG-2 mergeado (NextAuth v5 + Prisma + `/api/apartments`,`/api/status` filtrados por userId), e2e 20/20, prod 200.

## 3. Requisitos do usuário (respostas ao questionário)

1. **Multiplicação:** SIM, ao mover de coluna o card aparece de novo na origem → corrigir (dedupe por `apartmentId`).
2. **Dash→Kanban:** página principal lista TODOS os imóveis; marcar imóvel com um **status tab** manda pro kanban (status ≠ "novo"/"inativo" ⇒ entra no board).
3. **Delete = soft-delete:** deletar no dash remove da visualização (dash E kanban), imóvel permanece no banco para buscas futuras. Aplicar no back: `deletedAt DateTime?` em `SavedProperty` + filtrar queries por `deletedAt: null`. No modo legado (sem backend), usar a lista `REMOVED_IDS_STORAGE_KEY` já existente.
4. **Melhorias aprovadas:** (a) SIM filtro por coluna no kanban; (b) batch NÃO precisa; (c) SIM integração WhatsApp automática — o link já existe (`buildWhatsAppLink` em `lib/antiDores.ts`, E.164); adicionar botão/ação "abrir WhatsApp" no card do kanban + copiar mensagem padrão.
5. **Referências de boas práticas a pesquisar** (subagente researcher, web): KanbanGuide "Limiting WIP", Atlassian "Kanban best practices" (filtros/swimlanes), GitHub Projects (card → issue one-way), Trello (archive vs delete — soft delete!). Trazem padrão: **archive/soft-delete é o padrão de mercado; duplicação ao mover = bug de dedupe no state, não de DnD**.

## 4. Critérios de aceitação

- [ ] Mover card entre colunas NUNCA duplica (e2e: mover 3x e contar cards == imóveis únicos).
- [ ] Cards do kanban com `apartmentId` duplicado são dedupados por id antes de renderizar (guard no `columns` useMemo).
- [ ] Dashboard tem status tab por imóvel; setar status ≠ novo adiciona ao kanban.
- [ ] Dashboard e kanban só listam imóveis com `deletedAt: null` (back) / não presentes em `REMOVED_IDS` (legado).
- [ ] DELETE `/api/apartments/[id]` faz soft-delete (`deletedAt: now`); dados preservados.
- [ ] Filtro por coluna no kanban (chip "Todas" + colunas).
- [ ] Botão WhatsApp no card do kanban (usa `buildWhatsAppLink` existente).
- [ ] Modo legado (sem DATABASE_URL) continua funcionando 100% (localStorage), e2e 20/20 continua verde.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx playwright test` verdes.
- [ ] Commits atômicos por worktree (T1 dash-status-tab, T2 schema soft-delete, T3 API soft-delete+filtro, T4 e2e novos).

## 5. Limites e não-metas

- NÃO migrar o app inteiro pra backend: modo legado permanece o caminho padrão de dev.
- NÃO mexer em auth/NextAuth/prisma generate já estabilizados no LAG-2.
- NÃO adicionar biblioteca de DnD (HTML5 nativo já está em uso, commit 71cab93d).
- NÃO subir vídeos/arquivos >5MB (regra de projeto). Sem segredos no repo; `.env.local` intocável.
- YouTube/refs externas: só leitura; nada de scraping pesado.

## 6. Execução (4 tasklets paralelos, worktrees já prontas)

- **T1 (oc-auth → dash/status-tab):** Dashboard.tsx — status tab por imóvel (menu: novo/contatado/visita/agendado/visitado/descartado/inativo). Sincroniza com AppContext (`updateStatus`). Imóvel descartado/inativo some do kanban, permanece no dash com tag. Commit `feat(dash): status tab por imóvel envia pro kanban`.
- **T2 (oc-db → schema soft-delete):** `prisma/schema.prisma` — `deletedAt DateTime?` em `SavedProperty` + `@@index([userId, deletedAt])`. `prisma generate` + typecheck. Commit `feat(db): soft-delete SavedProperty (deletedAt)`.
- **T3 (oc-api → API):** `/api/apartments` GET/POST filtram `deletedAt: null`; DELETE `/api/apartments/[id]` seta `deletedAt`. Modo legado: respeita `REMOVED_IDS` no client (já existe). Commit `feat(api): soft-delete + filtro deletedAt`.
- **T4 (oc-qa → dedupe+e2e):** Guard dedupe no `columns` useMemo (KanbanBoard) e no pool de `apartments` (AppContext, por `apartmentId`); filtro por coluna (chips); botão WhatsApp no card (`buildWhatsAppLink`); e2e novos: mover 3x sem duplicar, soft-delete esconde imóvel, status tab muda kanban. Commit `feat(kanban): dedupe + filtro coluna + WhatsApp + e2e`.

## 7. Entrega

- Branches `oc/auth|db|api|qa` com commits atômicos + push. Orquestrador (Hermes) faz o merge no master, roda QA final (tsc/lint/build/e2e) e deploy Vercel `--prebuilt` fora do git dir (workaround Hobby).
- Monitor: subagente Hermes `delegate_task` polling `git log` das 4 worktrees a cada 60s, reporta quando as 4 tiverem commit novo.

## 8. Pendências conhecidas (não deste change)

- Seed admin `guinness/curitiba2026` no Neon (projeto `quiet-truth-42958341` não visível na conta `gnnss777`; dono real = Gabriel — verificar conta/org antes).
- Kanban "O Cartão" (devs-projects) spawnando zombie workers — projeto separado, não mexer.
