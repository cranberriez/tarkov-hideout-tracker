# Tarkov Hideout Tracker — Docs

Design and architecture reference for the Tarkov Hideout Tracker.

---

## Architecture

- **[overview.md](overview.md)**
  High-level goals, core concepts (FiR, game editions, game mode, filters), pages, and data sources.

- **[state-management.md](state-management.md)**
  Zustand stores (`useUserStore`, `useUIStore`) — full state shapes, actions, and separation from server-fetched data.

- **[data-and-price-context-architecture.md](data-and-price-context-architecture.md)**
  How server services, React contexts (`DataContext`, `PriceDataContext`), and `<Suspense>` work together to deliver station/item/price data.

- **[api-routes.md](api-routes.md)**
  The only public route (cron endpoint) and the internal server services that replace old public API routes.

- **[caching-architecture.md](caching-architecture.md)**
  Redis keys, Next.js `unstable_cache` wrappers, cache invalidation strategy, and how to add a new cached data source.

---

## Features

- **[hideout-page.md](hideout-page.md)**
  Behavior and data requirements for the Hideout station list page.

- **[item-checklist-page.md](item-checklist-page.md)**
  Behavior and data requirements for the pooled item checklist page.

- **[quests-page.md](quests-page.md)**
  Quests page — quest item requirements (giveItem objectives), trader/level filters, prerequisite ordering, and caching.

- **[quick-add-feature.md](quick-add-feature.md)**
  Quick Add modal — post-raid item input, fuzzy search, FiR/non-FiR counts.

- **[setup-feature.md](setup-feature.md)**
  Onboarding flow — game mode (PVP/PVE) and game edition selection; edition bonus logic.

---

## External APIs & Integrations

- **[graphql-queries.md](graphql-queries.md)**
  Tarkov.dev GraphQL queries used for hideout station structure and item metadata.

- **[hideoutQL.md](hideoutQL.md)**
  Minimal reference GraphQL query for hideout stations.

- **[tasks-graphql.md](tasks-graphql.md)**
  Live schema findings for the `tasks` and `traders` queries — full field reference, objective type breakdown, and service implementation notes.

- **[cron-jobs.md](cron-jobs.md)**
  Vercel cron setup, bulk Tarkov Market price refresh, manual trigger instructions, and troubleshooting.

- **[tarkov-market-protection.md](tarkov-market-protection.md)**
  How the Tarkov Market API key is protected (server-only architecture) and historical context on the previous public-route design.

---

## Maintenance

- **[deprecatedFiles.md](deprecatedFiles.md)**
  Files that have been superseded and are candidates for removal.

- **[notes.txt](notes.txt)**
  Informal feature ideas and development notes.
