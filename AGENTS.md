# AGENTS.md

Start with the requested files and their immediate dependencies. Read only the
documentation sections needed for the change; no documentation is mandatory for
every task. Source is authoritative. Update affected docs when behavior,
contracts, persistence rules, or data flow change.

## Project constraints

- Preserve player data. Before changing persistence, store actions, migrations,
  profile scope, or reset behavior, read [user state](docs/user-state.md) and the
  owning store/hook. Never clear saved data as a workaround.
- Preserve stable Tarkov entity and requirement IDs. Keep PVP, PVE, and KORD data
  and caches isolated using the existing mode mapping.
- Validate and normalize provider records at the adapter boundary. Invalid or
  empty required input must not publish a ready release or replace good prices.
- Keep server code out of client imports. Shared layouts do not preload entity
  arrays; pages use named queries and prefer known-ID/batch reads. Queries do not
  import provider services.
- Report missing IDs and partial errors explicitly. Missing data cannot satisfy
  a requirement; profit figures require both recipe graphs.
- Keep `plans/` ignored by Git. Its contents are disposable, non-authoritative,
  and must not be linked from docs or used in validation. Skip `plans/future/`
  and `plans/notes/` in routine work.

## Documentation by task

Use the relevant sections when the change touches these concerns. Follow links
only as needed; [docs/README.md](docs/README.md) is an optional index.

| Concern | Reference |
| --- | --- |
| Routes, shared UI, dependency boundaries, Hideout/Items composition | [Architecture](docs/architecture.md) |
| Providers, domain types, queries/APIs, search, prices, caching | [Data layer](docs/data-layer.md) |
| Saved progress/preferences, profiles, setup, migrations, resets | [User state](docs/user-state.md) |
| Quest availability, demand, workspace, imports, Kappa | [Quests](docs/quests.md) |
| Maps, objective markers, projection, overlays | [Maps](docs/maps.md) |
| Recipe costs, acquisition optimization, profits | [Profits](docs/profits.md) |
| Setup, release/price operations, diagnostics, validation commands | [Operations](docs/operations.md) |

For a local visual change, inspect the component and the relevant UI conventions.
Expand to persistence or data-layer docs only if the change reaches those boundaries.

## Implementation and validation

Keep substantial deterministic derivation in pure models, workflow/network effects
in controllers, and views focused on rendering and direct interaction. Reuse existing
utilities and store actions. Keep local state local unless it needs a shared owner.

Choose validation for the affected behavior: focused adjacent tests for logic,
architecture/contract checks for boundary changes, and lint/build when relevant.
For UI changes, use `npm run dev` to verify affected interactions and relevant
loading/error states and mode switches. Docs-only changes need `npm run docs:check`.
[package.json](package.json) and [operations](docs/operations.md) list available
checks; they are not a requirement to run every suite for every edit. Report
failures without resetting data or changing unrelated code to hide them.

## Cost-aware delegation

Use a `cheap_explorer` Luna agent for bounded, low-risk work that benefits from
multiple searches, repetitive reads, or mechanical processing. Do not delegate
cheap or obvious targeted file reads.
