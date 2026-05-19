# API Routes & Server Services

The app uses **no public API routes for hideout, items, quest, or market price page data**. Page data fetching happens in server components/services and is delivered to client components via React context or server props. The only public route is the Vercel cron endpoint.

For the original plan that included public routes (`/api/hideout/stations`, `/api/market/items`, etc.), see git history. That pattern was superseded by the server-service + context architecture described in `data-and-price-context-architecture.md`.

---

## Public Routes

### `GET /api/cron/price-update`

**File:** `src/app/api/cron/price-update/route.ts`

Triggered daily at **00:00 UTC** by Vercel Cron (configured in `vercel.json`). Protected by `CRON_SECRET`; requests without the matching `Authorization: Bearer <secret>` header are rejected with 401.

**What it does:**

1. Calls `refreshTarkovDevMarketPrices("PVP")` and `refreshTarkovDevMarketPrices("PVE")` in parallel.
2. Each call fetches hideout-required and quest-required item flea market fields from Tarkov.dev GraphQL using `gameMode: regular` or `gameMode: pve`.
3. Writes compact `normalizedName -> MarketPrice` maps into Redis.

See `cron-jobs.md` for full details.

---

## Server Services

These are internal TypeScript modules, not HTTP routes. They are imported directly by server components and use Next.js `unstable_cache` for ISR-style caching. See `caching-architecture.md` for current Redis keys and invalidation rules.

### `getCachedHideoutStations()`

**File:** `src/server/services/hideout.ts`

Fetches all hideout stations from Tarkov.dev GraphQL, merges app overrides, and returns a normalized list.

```ts
TimedResponse<{ stations: Station[] }>;
```

### `getCachedHideoutRequiredItems()`

**File:** `src/server/services/items.ts`

Derives the unique set of item IDs required across all hideout stations, then fetches only those items from Tarkov.dev. Avoids fetching the full item catalogue.

```ts
TimedResponse<{ items: ItemDetails[] }>;
```

### `getCachedMarketPrices(normalizedNames, gameMode)`

**File:** `src/server/services/marketPrices.ts`

Reads the pre-built bulk price map from Redis and returns a subset filtered to the requested `normalizedNames`. The map is written by the cron job; this service is read-only.

```ts
TimedResponse<Record<string, MarketPrice | null>>;
```

### `refreshTarkovDevMarketPrices(mode)`

**File:** `src/server/services/tarkovDevMarket.ts`

Called by the cron route only. Fetches volatile flea market fields for hideout-required and quest-required items from Tarkov.dev and writes the PVP/PVE price maps to Redis.

### `getCachedQuestData()`

**File:** `src/server/services/quests.ts`

Fetches Tarkov.dev tasks and filters the result to quests that have `giveItem` objectives. Each returned quest keeps only `giveItem` objectives. This is the lighter quest shape used when full objective detail is not needed.

```ts
TimedResponse<{ quests: Quest[] }>;
```

### `getCachedFullQuestData()`

**File:** `src/server/services/quests.ts`

Fetches full Tarkov.dev task data for normal PMC quest progression, including all objective types, fail conditions, maps, trader requirements, prestige requirements, and trader images. This is the current source for both `/items` quest item metadata and `/quests`.

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
| `CRON_SECRET`                                    | Guards `/api/cron/price-update`             |
