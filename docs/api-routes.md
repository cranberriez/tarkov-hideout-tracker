# API Routes & Server Services

The app uses **no public API routes for hideout, items, or market price data**. All data fetching happens in server components/services and is delivered to the client via React context. The only public route is the Vercel cron endpoint.

For the original plan that included public routes (`/api/hideout/stations`, `/api/market/items`, etc.), see the git history — that pattern was superseded by the server-service + context architecture described in `data-and-price-context-architecture.md`.

---

## Public Routes

### `GET /api/cron/bulk-update`

**File:** `src/app/api/cron/bulk-update/route.ts`

Triggered daily at **00:00 UTC** by Vercel Cron (configured in `vercel.json`). Protected by `CRON_SECRET` — requests without the matching `Authorization: Bearer <secret>` header are rejected with 401.

**What it does:**
1. Calls `refreshTarkovMarketPrices("PVP")` and `refreshTarkovMarketPrices("PVE")` in parallel.
2. Each call fetches the full item catalogue from Tarkov Market (`/api/v1/items/all` for PVP, `/api/v1/pve/items/all` for PVE).
3. Filters the response down to only items required by the hideout.
4. Writes a compact `normalizedName → MarketPrice` map into Redis.

See `cron-jobs.md` for full details.

---

## Server Services

These are internal TypeScript modules, not HTTP routes. They are imported directly by server components (layouts, pages) and use Next.js `unstable_cache` for ISR-style caching.

### `getCachedHideoutStations()`

**File:** `src/server/services/hideout.ts`
**Cache:** Redis key `hideout:stations:v6`, Next.js revalidate 12h.

Fetches all 25 hideout stations from Tarkov.dev GraphQL, merges with `wiki-data.json` overrides, and returns a normalized list.

**Return shape:**
```ts
{
  data: { stations: Station[] };
  updatedAt: number;
}
```

### `getCachedHideoutRequiredItems()`

**File:** `src/server/services/items.ts`
**Cache:** Redis key `hideout:items:filtered:v1`, Next.js revalidate 12h.

Derives the unique set of item IDs required across all hideout stations, then fetches only those items from Tarkov.dev. Avoids fetching the full item catalogue.

**Return shape:**
```ts
{
  data: { items: ItemDetails[] };
  updatedAt: number;
}
```

### `getCachedMarketPrices(normalizedNames, gameMode)`

**File:** `src/server/services/marketPrices.ts`
**Cache:** Next.js revalidate 5min.

Reads the pre-built bulk price map from Redis and returns a subset filtered to the requested `normalizedNames`. The map is written by the cron job — this service is read-only.

**Return shape:**
```ts
{
  data: Record<string, MarketPrice | null>;  // keyed by normalizedName
  updatedAt: number;
}
```

### `refreshTarkovMarketPrices(mode)`

**File:** `src/server/services/tarkovMarketBulk.ts`
**Called by:** Cron route only.

Fetches the full item list from Tarkov Market, filters to hideout-required items, and writes to Redis:
- PVP: `tarkov-market:all-prices:filtered:v1:pvp`
- PVE: `tarkov-market:all-prices:filtered:v1:pve`

### `getCachedQuestData()`

**File:** `src/server/services/quests.ts`
**Cache:** Redis keys `quests:all:v3` + `quests:all:v3:meta`, Next.js revalidate 12h.

Fetches all quests from Tarkov.dev GraphQL via the `QUESTS_QUERY`. Filters objectives down to `giveItem` type only. Returns a `QuestsPayload` with the full quest list and a de-duped list of required items.

**Return shape:**
```ts
{
  data: {
    quests: QuestSummary[];      // all quests with giveItem objectives
    requiredItems: ItemDetails[]; // unique items referenced across all quest objectives
  };
  updatedAt: number;
}
```

**Key types:**
```ts
interface QuestSummary {
    id: string;
    name: string;
    normalizedName?: string;
    wikiLink?: string;
    taskImageLink?: string;
    minPlayerLevel?: number;
    prerequisiteTaskIds: string[];
    trader?: { normalizedName: string };
    map?: { normalizedName: string };
    itemRequirements: QuestItemRequirement[];
}

interface QuestItemRequirement {
    id: string;
    type: string; // always "giveItem" in practice
    count: number;
    foundInRaid: boolean;
    item: Pick<ItemDetails, "id" | "name" | "normalizedName" | "iconLink" | "gridImageLink" | "wikiLink" | "link">;
}
```

**Also exports** `orderQuestsByPrerequisites(quests)` — sorts quests by prerequisite chain depth (topological sort), then `minPlayerLevel`, then name. Returns `OrderedQuest[]` (extends `QuestSummary` with `prerequisiteDepth: number`).

### `getCachedTraders()`

**File:** `src/server/services/traders.ts`
**Cache:** Redis keys `traders:all:v1` + `traders:all:v1:meta`, Next.js revalidate 12h.

Fetches the trader list from Tarkov.dev GraphQL (`TRADERS_QUERY`). Used by the `/quests` page to display trader avatars in the filter dropdown.

**Return shape:**
```ts
{
  data: {
    traders: TraderSummary[];
  };
  updatedAt: number;
}

interface TraderSummary {
    name: string;
    normalizedName: string;
    imageLink?: string;
    image4xLink?: string;
}
```

### `getTarkovMarketItemByNormalizedName(name, mode)` (Legacy)

**File:** `src/server/services/tarkovMarket.ts`

Per-item Tarkov Market lookup with its own Redis cache. Kept as a fallback/debugging tool. Not used in the main data flow.

---

## Redis Client

**File:** `src/server/redis.ts`

Singleton Upstash Redis client. Initialized from `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables.

---

## Environment Variables

| Variable | Used by |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Redis client |
| `UPSTASH_REDIS_REST_TOKEN` | Redis client |
| `TARKOV_MARKET_KEY` | Tarkov Market API auth header (`x-api-key`) |
| `CRON_SECRET` | Guards `/api/cron/bulk-update` |
