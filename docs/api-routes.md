# API Routes & Server Services

The app uses **no public API routes for hideout, items, quest, or market price page data**. Page data fetching happens in server components/services and is delivered to client components via React context or server props. `src/server/services/tarkovData.ts` routes quest and item data through the Tarkov.dev JSON API; its legacy provider selection applies only to remaining station and trader services.

For the original plan that included public routes (`/api/hideout/stations`, `/api/market/items`, etc.), see git history. That pattern was superseded by the server-service + context architecture described in `data-and-price-context-architecture.md`.

---

## Public Routes

The authenticated `/api/revalidate` maintenance route can invalidate the
`item-data`, `hideout-data`, and `quests` cache tags. There is no public item or
price data route and no price-refresh cron.

---

## Server Services

These are internal TypeScript modules, not HTTP routes. They are imported directly by server components and use Next.js `unstable_cache` for ISR-style caching. See `caching-architecture.md` for current Redis keys and invalidation rules.

### `getCachedHideoutStations()`

**File:** `src/server/services/hideout.ts`

Fetches all hideout stations from the selected provider, merges app overrides, and returns a normalized list.

```ts
TimedResponse<{ stations: Station[] }>;
```

### `getCachedHideoutRequiredItems()`

**File:** `src/server/services/itemsJson.ts`

Derives the unique set of item IDs referenced by hideout and quest data, then maps those records from the mode-specific Tarkov.dev JSON `/items` dataset. Each returned item includes its embedded flea and trader pricing plus useful general metadata; the full catalog is not sent to the browser.

```ts
TimedResponse<{ items: ItemDetails[] }>;
```

### `getCachedQuestData()`

**File:** `src/server/services/questsJson.ts`

Fetches the active profile's mode-prefixed Tarkov.dev tasks dataset and filters the result to quests that have `giveItem` objectives. Each returned quest keeps only `giveItem` objectives. This is the lighter quest shape used when full objective detail is not needed.

```ts
TimedResponse<{ quests: Quest[] }>;
```

### `getCachedFullQuestData()`

**File:** `src/server/services/questsJson.ts`

Fetches and hydrates the active profile's `/regular/tasks`, `/pve/tasks`, or `/pvp-season/tasks` JSON dataset, including level-0 quests, all objective types, fail conditions, maps, trader requirements, prestige requirements, and trader images. This is the only runtime quest provider and is the current source for both `/items` quest item metadata and `/quests`.

```ts
TimedResponse<{ quests: FullQuest[] }>;
```

### `orderQuestsByPrerequisites(quests)`

**File:** `src/server/services/quests.ts`

Sorts quests by prerequisite chain depth, then `minPlayerLevel`, then name. It works with both the lightweight and full quest shapes as long as they include `id`, `name`, `minPlayerLevel`, and `taskRequirements`.

### `getCachedTraders()`

**File:** `src/server/services/traders.ts`

Fetches the trader list from Tarkov.dev GraphQL. The service remains available for future server-side use, but the current quests UI derives its sidebar trader list from the loaded full quest data.

```ts
TimedResponse<{ traders: Trader[] }>;
```

## Redis Client

**File:** `src/server/redis.ts`

Singleton Upstash Redis client. Initialized from `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

---

## Environment Variables

| Variable                                         | Used by                                     |
| ------------------------------------------------ | ------------------------------------------- |
| `UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL`     | Redis client                                |
| `UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN` | Redis client                                |
| `CRON_SECRET`                                    | Guards `/api/revalidate`                    |
