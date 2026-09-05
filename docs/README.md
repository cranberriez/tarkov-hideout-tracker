# Project documentation

Start with [architecture](architecture.md), then read the owner for the behavior
you are changing. Source code is authoritative when a document disagrees; correct
the owning document in the same change. [AGENTS.md](../AGENTS.md) supplies the
contributor invariants and a task-to-source routing table.

| Document | Owns |
|---|---|
| [Architecture](architecture.md) | Routes, dependency direction, Hideout, Items, Quick Add, and client composition |
| [Data layer](data-layer.md) | Ingestion, repository/query contracts, API reads, releases, current prices, and caching |
| [User state](user-state.md) | Persistent owners, profiles, migrations, setup, and reset scope |
| [Quests](quests.md) | Progression, demand, workspace, sync/import, and Kappa |
| [Maps](maps.md) | Objective geometry, projection, floors, overlays, and SVG delivery |
| [Profits](profits.md) | Acquisition optimization, recipe availability, price inputs, and profit UI |
| [Operations](operations.md) | Setup, validation commands, release/price operations, and diagnostics |

These eight files (including this index) are the active reference set. The
[database tooling README](../db-scripts/README.md) owns detailed ingestion CLI
usage. Research notes and [wiki source](../wiki-src/) are non-authoritative working
material; verify against source before using them. Git history retains superseded
documentation.
