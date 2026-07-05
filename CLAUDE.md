# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run lint     # ESLint
```

There are no automated tests. Verify behavior by running the dev server.

## Environment Variables

Copy `.sample.env` to `.env`. Required variables:

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN` | Upstash Redis auth token |
| `TARKOV_MARKET_KEY` | Tarkov Market API key (server-only, never exposed to client) |
| `CRON_SECRET` | Bearer token required by the cron endpoint |

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Zustand · Radix UI · Upstash Redis · Vercel

### Data Flow

```
Tarkov.dev GraphQL ──► server/services/ ──► Redis ──► (data)/layout.tsx ──► DataContext (stations + items)

Prices (client-fetched, NOT embedded in pages):
Redis ──► /api/prices/[mode]  (ISR route, tag "market-prices")
              └──► fetched client-side by PriceDataLayout ──► PriceDataContext

Cron at 00:00 UTC ──► /api/cron/price-update ──► Redis + revalidateTag("market-prices")
```

All pages under `src/app/(data)/` receive station/item data through server-side context. Prices are fetched client-side per game mode from `/api/prices/[mode]` (CDN/ISR-cached; keep them out of the RSC payload — this was a major Vercel cost issue). The root `/` redirects to `/hideout`.

### Cache Invalidation

Pages and `unstable_cache` entries use long time-based revalidates (14 days) plus tags: `market-prices` (revalidated daily by the price cron), `hideout-data` (stations + items), `quests` (quests + traders). To invalidate after a game patch:

```
curl -H "Authorization: Bearer $CRON_SECRET" "https://<host>/api/revalidate?tag=quests"
```

Keep short `revalidate` values out of anything rendered by the `(data)` layout — the lowest revalidate used during a render sets the ISR interval for the whole route and drives up Vercel ISR writes.

### Server Services (`src/server/services/`)

Each service wraps a two-layer cache: **Redis** (survives deploy) + **Next.js `unstable_cache`** (in-process, short TTL).

| Service | Redis Key Pattern | TTL |
|---|---|---|
| `hideout.ts` | `hideout:stations:v{N}` | 12h |
| `items.ts` | `hideout:items:filtered:v{N}` | 12h |
| `marketPrices.ts` | `tarkov-market:all-prices:filtered:v{N}:{pvp\|pve}` | reads daily-written key |
| `tarkovMarketBulk.ts` | same as above | written by cron |

Cache version constants live in `src/lib/cfg/cacheVersions.ts`. **Bump the relevant version number to bust a Redis key** — do not manually delete keys.

### State Management

**`useUserStore`** (Zustand, persisted to `localStorage` key `tarkov-hideout-user-state` v2):
- Station levels, hidden stations, completed requirements, item counts (`have` / `haveFir`).
- All filter/view preferences: `checklistViewMode`, `hideCheap`, `hideMoney`, `showFirOnly`, `hideRequirements`, `hideoutCompactMode`, `itemsSize`, `sellToPreference`, `useCategorization`.
- Onboarding state: `gameEdition`, `gameMode`, `hasCompletedSetup`, `isSetupOpen`, `editionBonusesAppliedFor`.

**`useUIStore`** (Zustand, in-memory only):
- `isQuickAddOpen`, `pendingQuickAddItems`.

**React Contexts** (server data, read-only on client):
- `DataContext` → `stations`, `items`, timestamps
- `PriceDataContext` → `pvpPrices`, `pvePrices` (maps keyed by `normalizedName`)

### FiR (Found In Raid)

Items marked FiR have `attributes` containing `{ name: "found_in_raid", value: "true" }`. FiR truth comes from `src/lib/data/wiki-data.ts` (imports `hideout-data.json` with manual overrides) and falls back to `src/lib/cfg/foundInRaid.ts`. The data service in `hideout.ts` merges this at fetch time.

### Item Pooling

`src/lib/utils/item-pooling.ts` aggregates requirements across all visible stations into a flat item list. `src/lib/utils/item-needs.ts` computes per-item need counts. Both are called in `HideoutList.tsx` and `ItemsList.tsx`.

### Quests Page

The quests page is in-progress on the `quests` branch. Server-side services for quests (`getQuests`) and traders (`getTraders`) follow the same Redis + `unstable_cache` pattern as hideout data, but the page and feature components have not been added yet.

## Key Files for Common Tasks

| Task | Files |
|---|---|
| Add a new page | `src/app/(data)/<page>/page.tsx` + `src/components/core/Navbar.tsx` |
| Add new cached server data | New file in `src/server/services/`, call from `src/app/(data)/layout.tsx` |
| Add a new user preference | `src/lib/stores/useUserStore.ts` (state + action + reset) |
| Change FiR config | `src/lib/data/hideout-data.json` or `src/lib/cfg/foundInRaid.ts` |
| Change station render order | `src/lib/cfg/stationOrder.ts` |
| Add a new type | `src/types/types.ts` |
| Bust a Redis cache | Bump the version in `src/lib/cfg/cacheVersions.ts` |
| Wire a new modal | Add open state to `useUIStore`, add component to `src/features/` |

## Docs

Detailed architecture docs are in `docs/`. Key references:
- `docs/state-management.md` — authoritative store shapes
- `docs/caching-architecture.md` — Redis key naming, invalidation
- `docs/data-and-price-context-architecture.md` — DataContext + PriceDataContext pattern
- `docs/quests-page.md` — quests feature spec (in-progress)
- `docs/cron-jobs.md` — cron setup and manual trigger instructions
