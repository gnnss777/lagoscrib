# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues on `gnnss777/lagoscrib`
(public). Use the `gh` CLI for all operations. Already authenticated as
`gnnss777` — no token needed.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

Solo repo — nobody files PRs here. The PR surface this repo actually uses is
**internal**: the OverClick swarm opens `oc/*` branches, one git worktree per
lane (see `git worktree list`). Lane work is tracked by branch name, not by
issue.

## This repo's work is tracked in a story, not an issue

`docs/stories/S00N-*.md` is the real per-leva log — one file per delivery
(S001 schema, S008 4 portais, S010 teto all-in). A `gh issue` is the right tool
for **open questions and known defects that outlive a leva**. A leva gets a
story file, not an issue.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
