# Domain Docs

How the engineering skills should consume this repo's domain documentation when
exploring the codebase.

## Layout: single-context, non-standard paths

Single-context repo — no monorepo signals (`pnpm-workspace.yaml`, `workspaces`,
`packages/*` all absent). **But the doc paths are this repo's own.** Don't look
for `CONTEXT.md` or `docs/adr/`; they do not exist here and are not going to.

Read these instead:

| Instead of | Read |
| --- | --- |
| `CONTEXT.md` | `README.md` + `DESIGN.md` at the repo root |
| `docs/adr/0001-*.md` | `docs/ADR-00N-slug.md` — flat, **uppercase** `ADR` |
| — | `docs/stories/S00N-slug.md` — one per delivery, the leva log |
| — | `docs/ux/*.md` — UX rules per surface |
| — | `docs/handoff/*.md` — cross-session handoffs |

If any of these don't exist for the topic at hand, **proceed silently**. Don't
flag their absence and don't suggest creating them upfront. The
`/domain-modeling` skill creates new domain docs lazily when terms or decisions
actually get resolved.

## The pipeline is the domain

Read in this order before touching `scripts/coleta/`, `data/coleta/`, or
`lib/data.ts`:

1. `docs/ADR-001-pipeline.md` — the data pipeline contract
2. `docs/stories/S008-coleta-4-portais.md` — how the 4 portals are scraped
3. `docs/stories/S010-coleta-teto-allin-3500.md` — the most recent leva
4. `docs/ADR-004-telefone-coleta.md` — phone collection (**check the id; supersedes ADR-001 §5**)

`data/coleta/*.py` carries comments that state *why*, including anti-patterns
already paid for. `extrair.py` has the **anti-apagão** rule: never overwrite
good data with empty. Honour it in any new field you add.

## The Obsidian vault is a peer of `docs/`, not a mirror of it

This repo records decisions in **two** places, and they are expected to agree:

- repo: `docs/` — the versioned copy, what CI and reviewers read
- vault: `C:\AI\GNNSS_VAULT` — the durable copy that survives repo history, with
  the cross-project context

Vault entry points for this project:

- `20-projetos/applicativos/applicativos-app-context.md` → `apartamentos-app-context.md`
- `docs/YYYY-MM-DD-slug.md` in the vault, tags `#sdd #handoff #audit`
- `50-sistema/57-registros/postmortem-imovel-scraper.md` — **read before** building any new scraper

If you supersede an ADR here, supersede it in the vault too, or the wrong
lesson stays in the brain.

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a refactor proposal, a
hypothesis, a test name), use the term as it appears in `DESIGN.md` and the
ADRs. This repo's terms are load-bearing: *leva* (a data delivery), *coleta*
(scraping), *coletor* (the scraper), *all-in* (`rent + condo + iptu`),
*região* (the neighbourhood groupings in `lib/neighborhoods.ts`).

`condoUnknown: true` means the condominium fee was **not published** — the
value is `0`, never an estimate. Same principle applies to every other field:
missing is missing, don't invent it.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than
silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
