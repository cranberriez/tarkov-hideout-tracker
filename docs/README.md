# Tarkov Hideout Tracker - Docs

Design and architecture reference for the Tarkov Hideout Tracker.

Docs are grouped by purpose:

- **Current architecture**: authoritative references for existing code.
- **Feature spec**: current feature behavior and implementation notes.
- **Historical plan**: older planning docs kept for context; verify against source before using.
- **Notes**: informal ideas or cleanup lists.

---

## Architecture

- **[overview.md](overview.md)** - Current architecture
  High-level goals, core concepts (FiR, game editions, game mode, filters), pages, and data sources.

- **[state-management.md](state-management.md)** - Current architecture
  Zustand stores (`useUserStore`, `useUIStore`) - full state shapes, actions, and separation from server-fetched data.

- **[game-mode-profiles.md](game-mode-profiles.md)** - Current architecture
  Independent PVP, PVE, and KORD character profiles, legacy-state retention, cookies, and mode-aware server data.

- **[data-and-price-context-architecture.md](data-and-price-context-architecture.md)** - Current architecture
  How `DataContext` delivers ID-based stations and the compact global item catalog with market pricing.

- **[api-routes.md](api-routes.md)** - Current architecture
  Maintenance, price-history, and lazy item-usage routes plus their backing server services.

- **[caching-architecture.md](caching-architecture.md)** - Current architecture
  Redis keys, Next.js `unstable_cache` wrappers, cache invalidation strategy, and how to add a new cached data source.

- **[dev-panel.md](dev-panel.md)** - Development tooling
  Development-only cache policy inspection and quest snapshot comparison.

- **[mapping-architecture.md](mapping-architecture.md)** - Current architecture
  Quest objective geometry, compact SVG map manifests, projection, and the Raid Planner map viewer.

---

## Features

- **[hideout-page.md](hideout-page.md)** - Feature spec
  Behavior and data requirements for the Hideout station list page.

- **[item-checklist-page.md](item-checklist-page.md)** - Feature spec
  Behavior and data requirements for the pooled item checklist page.

- **[profit-pages.md](profit-pages.md)** - Feature spec
  Recursive barter/craft costing, manual prices, availability filters, and profit-page data flow.

- **[kappa-checklist-page.md](kappa-checklist-page.md)** - Feature spec
  Collector item checklist, interaction behavior, and its independent persisted state.

- **[quests-page.md](quests-page.md)** - Feature spec
  Quests page - quest item requirements, trader/map views, prerequisite ordering, manual sync, and caching.

- **[quest-data-and-category-rework.md](quest-data-and-category-rework.md)** - Current data flow and implementation plan
  How quest data enters the app and the planned LL1-LL4 plus Series Quests organization.

- **[quick-add-feature.md](quick-add-feature.md)** - Feature spec
  Quick Add modal - post-raid item input, fuzzy search, FiR/non-FiR counts.

- **[setup-feature.md](setup-feature.md)** - Feature spec
  Onboarding flow - game mode (PVP/PVE) and game edition selection; edition bonus logic.

- **[item-source-filtering.md](item-source-filtering.md)** - Historical plan
  Original planning notes for hideout vs quest item source filtering. Verify against `item-checklist-page.md` and source before using.

- **[quest-completion-filtering.md](quest-completion-filtering.md)** - Historical plan
  Original refactor plan for quest completion filtering. Verify against `item-checklist-page.md`, `quests-page.md`, and source before using.

---

## External APIs & Integrations

- **[tarkov-json-api.md](tarkov-json-api.md)** - Current architecture
  JSON-only runtime datasets, translation behavior, mode isolation, and cache-safety behavior.

- **[graphql-queries.md](graphql-queries.md)** - Historical reference
  Retired Tarkov.dev GraphQL queries retained for implementation history.

- **[hideoutQL.md](hideoutQL.md)** - Notes
  Minimal reference GraphQL query for hideout stations.

- **[tasks-graphql.md](tasks-graphql.md)** - Historical reference
  Retired task/trader GraphQL schema findings retained for implementation history.

- **[tarkov-market-protection.md](tarkov-market-protection.md)** - Historical note
  Old Tarkov Market integration context. Current price data comes from Tarkov.dev GraphQL.

---

## Maintenance

- **[deprecatedFiles.md](deprecatedFiles.md)** - Notes
  Files that have been superseded and are candidates for removal.

- **[notes.txt](notes.txt)** - Notes
  Informal feature ideas and development notes.
