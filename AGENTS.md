<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

GitHub Issues on `gnnss777/lagoscrib`, via `gh` (already authenticated). Per-leva delivery logs live in `docs/stories/S00N-*.md`, not in issues. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, as-is: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Plus `needs-physics-check` for anything depending on live portal behaviour. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. This repo does **not** use `CONTEXT.md` or `docs/adr/` — read `docs/ADR-00N-*.md` (uppercase), `docs/stories/`, `README.md` and `DESIGN.md`. Decisions are recorded in the repo `docs/` **and** mirrored to the Obsidian vault. See `docs/agents/domain.md`.

## Coleta de imóveis

`lib/data.ts` is the source of truth. It is **generated** — never hand-edit it;
edit the pipeline that writes it and re-run:

```
node scripts/coleta/coleta.mjs --cdp=http://127.0.0.1:9222   # browser real, sessão logada
python data/coleta/merge.py
python data/coleta/download.py
python data/coleta/generate.py                                # escreve lib/data.ts
```

Rules that are not negotiable:

1. **Toda leva passa por `--cdp=`.** The phone and the Cloudflare clearance both
   need a real logged-in browser. Without it you get zero phones.
2. **`phone` é campo obrigatório do schema.** A new property with no phone is
   allowed (log it), but a leva that collects **zero** phones across every
   property means the scraper broke — not that the portals hid the numbers.
   `manifesto.py` reports the coverage for exactly this reason.
3. **Nunca sobrescreva um dado bom com vazio** (anti-apagão, `extrair.py`). A
   new leva that can't reach a phone must leave the previous value alone.
4. **`condo` desconhecido = `0 + condoUnknown: true`.** Never estimate.
5. **Clicar "mostrar telefone" registra lead no painel do anunciante.** Keep the
   `DELAY` between clicks and log which properties got clicked.

