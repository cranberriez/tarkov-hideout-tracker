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

- **[data-and-price-context-architecture.md](data-and-price-context-architecture.md)** - Current architecture
  How server services, React contexts (`DataContext`, `PriceDataContext`), and `<Suspense>` work together to deliver station/item/price data.

- **[api-routes.md](api-routes.md)** - Current architecture
  The only public route (cron endpoint) and the internal server services that replace old public API routes.

- **[caching-architecture.md](caching-architecture.md)** - Current architecture
  Redis keys, Next.js `unstable_cache` wrappers, cache invalidation strategy, and how to add a new cached data source.

---

## Features

- **[hideout-page.md](hideout-page.md)** - Feature spec
  Behavior and data requirements for the Hideout station list page.

- **[item-checklist-page.md](item-checklist-page.md)** - Feature spec
  Behavior and data requirements for the pooled item checklist page.

- **[quests-page.md](quests-page.md)** - Feature spec
  Quests page - quest item requirements, trader/map views, prerequisite ordering, manual sync, and caching.

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

- **[graphql-queries.md](graphql-queries.md)** - Current architecture
  Tarkov.dev GraphQL queries used for hideout station structure and item metadata.

- **[hideoutQL.md](hideoutQL.md)** - Notes
  Minimal reference GraphQL query for hideout stations.

- **[tasks-graphql.md](tasks-graphql.md)** - Current architecture
  Live schema findings for the `tasks` and `traders` queries - full field reference, objective type breakdown, and service implementation notes.

- **[cron-jobs.md](cron-jobs.md)** - Current architecture
  Vercel cron setup, bulk Tarkov Market price refresh, manual trigger instructions, and troubleshooting.

- **[tarkov-market-protection.md](tarkov-market-protection.md)** - Current architecture
  How the Tarkov Market API key is protected (server-only architecture) and historical context on the previous public-route design.

---

## Maintenance

- **[deprecatedFiles.md](deprecatedFiles.md)** - Notes
  Files that have been superseded and are candidates for removal.

- **[notes.txt](notes.txt)** - Notes
  Informal feature ideas and development notes.
