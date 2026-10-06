# Project documentation

Use this index when you need to locate a behavior reference. Start with the files
involved in the task and read only the relevant documentation sections; there is
no required documentation sequence. Source code is authoritative when a document
disagrees; correct affected documentation in the same change.
[AGENTS.md](../AGENTS.md) supplies project constraints and task-based doc routing.

| Document                        | Owns                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| [Architecture](architecture.md) | Routes, dependency direction, Hideout, Items, Quick Add, and client composition         |
| [Data layer](data-layer.md)     | Ingestion, repository/query contracts, API reads, releases, current prices, and caching |
| [User state](user-state.md)     | Persistent owners, profiles, migrations, setup, and reset scope                         |
| [Quests](quests.md)             | Progression, demand, workspace, log import, and Kappa                                   |
| [Maps](maps.md)                 | Objective geometry, projection, floors, overlays, and SVG delivery                      |
| [Profits](profits.md)           | Acquisition optimization, recipe availability, price inputs, and profit UI              |
| [Operations](operations.md)     | Setup, validation commands, release/price operations, and diagnostics                   |

These eight files (including this index) are the current behavior reference set.
The [PostgreSQL migration](postgresql-migration.md) records the agreed architecture.
The [production cutover runbook](postgresql-cutover.md) separates deployment,
readiness and rollback from implementation. The [database tooling README](../db-scripts/README.md) owns detailed ingestion CLI
usage. The [market-analyzer README](../market-analyzer/README.md) owns the VPS price
worker and its analytics. Research notes and [wiki source](../wiki-src/) are non-authoritative working
material; verify against source before using them. Git history retains superseded
documentation.
