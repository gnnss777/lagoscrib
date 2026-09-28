# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those
roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Sweep-specific label

`needs-physics-check` — the issue only passes once a human has opened the
portal in a real browser and seen the behaviour. Used for anything that depends
on third-party portal behaviour, which is most of `scripts/coleta/`.

Reason: this repo's own postmortem (`vault: 50-sistema/57-registros/postmortem-imovel-scraper.md`,
ERRO-2) records that a scraper that fails silently is worse than one that
errors. A live-browser check is the only thing that catches "the portal changed
the button and we didn't notice".

The labels above are the defaults, kept as-is. Edit the right-hand column if
the tracker ever uses a different vocabulary.
