# API Routes

This document specifies the backend HTTP API exposed by the Next.js app. These routes sit between the client and Tarkov.dev, and are responsible for caching data in Redis.

Assumptions:

-   Hosted on Vercel.
-   Using Redis (e.g. Upstash) as a cache layer.
-   All routes are **server-only** and never called directly from Tarkov.dev.

---

## Common Concepts

### Redis Keys

-   `hideout:stations:v2`
    -   JSON structure for all hideout stations, levels, and item requirements.
    -   Includes `normalizedName`, `imageLink`, and new requirements (Skill, Station, Trader).
-   `items:prices:v1`
    -   JSON map of item id → price info for items relevant to hideout requirements.

### Cache Policy

-   **Staleness window**: 30 minutes (configurable).
-   Two main approaches:
    -   Use Redis **TTL** and treat missing keys as needing a refetch.
    -   Store `updatedAt` inside the JSON and check `Date.now() - updatedAt`.

---

## `POST /api/market/items`

Fetches up-to-date market prices for one or more items from **Tarkov Market**, with a Redis-backed cache.

### Request Body

```ts
interface MarketItemsRequestBody {
    items?: string[]; // array of item normalizedNames
}
```

### Response Shape

```ts
interface MarketPrice {
    price?: number;
    avg24hPrice?: number;
    avg7daysPrice?: number;
    updated?: string; // ISO timestamp from Tarkov Market
}

type MarketItemsResponse = TimedResponse<{
    // key is the normalizedName that was requested
    [normalizedName: string]: MarketPrice | null;
}>;
```

### Behavior

-   Reads the `TARKOV_MARKET_KEY` env var and calls `https://api.tarkov-market.app/api/v1/item?q=...`.
-   Uses Redis keys of the form `tarkov-market:item:v3:<normalizedName>` plus a `:meta` key containing `{ updatedAt }`.
-   Treats any cached entry with `Date.now() - updatedAt < 45 minutes` as **fresh**.
-   Aggregates results for all requested items and returns them keyed by the requested `normalizedName`.
-   On upstream failure, falls back to any stale cached entry when available.

---

## `GET /api/hideout/stations`

Returns the canonical hideout structure for the client. This is a **normalized** version of the Tarkov.dev `hideoutStations` GraphQL query.

### Response Shape

```ts
interface HideoutStationsResponse {
    data: {
        stations: Station[];
    };
    updatedAt: number; // ms since epoch
}

interface Station {
    id: string;
    name: string;
    normalizedName: string; // e.g. "rest-space"
    imageLink?: string;
    levels: StationLevel[];
}

interface StationLevel {
    id: string;
    level: number;
    itemRequirements: ItemRequirement[];
    stationLevelRequirements: StationLevelRequirement[];
    skillRequirements: SkillRequirement[];
    traderRequirements: TraderRequirement[];
}

interface ItemRequirement {
    id: string;
    item: {
        id: string;
        name: string;
        shortName?: string;
        iconLink?: string;
        gridImageLink?: string;
    };
    count?: number;
    quantity?: number;
    attributes: RequirementAttribute[];
}

interface StationLevelRequirement {
    station: {
        normalizedName: string;
    };
    level: number;
}

interface SkillRequirement {
    name: string;
    skill: {
        name: string;
        imageLink?: string;
    };
    level: number;
}

interface TraderRequirement {
    trader: {
        name: string;
        normalizedName: string;
        imageLink?: string;
    };
    value: number;
}

interface RequirementAttribute {
    type: string;
    name: string;
    value: string;
}
```

### Behavior

-   **Check Redis** for `hideout:stations:v2`.
-   If present and `Date.now() - updatedAt < CACHE_WINDOW_MS`:
    -   Return cached value as-is.
-   Else:
    -   Call Tarkov.dev GraphQL `hideoutStations(lang: en)` with V2 query.
    -   Map raw response into the `Station` / `StationLevel` structure.
    -   Store `{ data, updatedAt: Date.now() }` under `hideout:stations:v2`.
    -   Return new value.

---

## `GET /api/items/prices`

Returns price information for items used in hideout requirements.

### Query Parameters

-   Optional: `ids=ID1,ID2,...`
    -   If absent, the server decides which IDs to fetch (e.g. all from cached hideout requirements).

### Response Shape

```ts
interface ItemsPricesResponse {
    data: Record<string, ItemPrice>; // itemId -> price
    updatedAt: number;
}

interface ItemPrice {
    id: string;
    name: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
    avg24hPrice?: number;
    basePrice?: number;
    lastLowPrice?: number;
}
```

### Behavior

-   **Determine the item ID set**:
    -   If `ids` query param present, use that list.
    -   Else, derive from `hideout:stations:v1.data.stations.*.levels.*.itemRequirements.*.item.id`.
-   **Check Redis** for `items:prices:v1`.
    -   If present and fresh enough, return it.
    -   If missing or stale:
        -   Call Tarkov.dev `items(ids: [ID!]!)` (may need batching).
        -   Map into `Record<string, ItemPrice>`.
        -   Store in Redis as `{ data, updatedAt }`.

### Error Handling

-   Similar to `/api/hideout/stations`.
-   Optionally return partial data if some items fail.

---

## `GET /api/hideout/summary` (Optional)

Optional helper route that precomputes an easy-to-consume summary for the UI. Not strictly required if the client performs all aggregation.

### Purpose

-   Provide a **flattened** representation of stations + levels + item requirements so the client does less work.

### Example Response

```ts
interface HideoutSummaryResponse {
    data: {
        stations: Station[]; // same as /api/hideout/stations
        itemIndex: Record<
            string,
            {
                item: ItemRequirement["item"];
                usedIn: Array<{
                    stationId: string;
                    stationName: string;
                    level: number;
                    requirementId: string;
                }>;
            }
        >;
    };
    updatedAt: number;
}
```

This route could be built on top of the cached `hideout:stations:v1` data, with no extra Tarkov.dev calls.
