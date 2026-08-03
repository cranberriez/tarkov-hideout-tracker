import { redis } from "@/server/redis";
import { getHideoutStations } from "@/server/services/hideout";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import type { ItemsPayload, TimedResponse, ItemDetails } from "@/types";
import { unstable_cache } from "next/cache";
import { isFreshCache, parseNonEmptyTimedResponse } from "@/server/services/tarkovJson/cache";

const REDIS_KEY = `hideout:items:filtered:v${CACHE_VERSIONS.hideoutItems}`;
const REDIS_KEY_META = `${REDIS_KEY}:meta`;
const TARKOV_GRAPHQL_ENDPOINT = "https://api.tarkov.dev/graphql";

interface TarkovItemsResponse {
    data?: {
        items: ItemDetails[];
    } | null;
    errors?: Array<{ message?: string }>;
}

const ITEMS_QUERY = `
query Items($ids: [ID!]) {
  items(ids: $ids, lang: en) {
    id
    name
    normalizedName
    iconLink
    gridImageLink
    category {
      name
      normalizedName
    }
    link
    wikiLink
  }
}
`;

export interface GetHideoutRequiredItemsOptions {
    revalidateSeconds?: number;
}

export async function getHideoutRequiredItems(
    options?: GetHideoutRequiredItemsOptions,
): Promise<TimedResponse<ItemsPayload>> {
    // 1. Try Redis cache first for already filtered items
    const [cachedBody, cachedMeta] = await redis.mget<[string, { updatedAt: number }]>(
        REDIS_KEY,
        REDIS_KEY_META,
    );

    const cached = parseNonEmptyTimedResponse<ItemsPayload>(cachedBody, (payload) => payload.items);
    const isFresh = isFreshCache(cachedMeta);

    if (isFresh && cached) {
        console.log("Using cached filtered items");
        return cached;
    }

    // 2. Fetch Stations to determine required Item IDs
    console.log("Cache stale or missing. Fetching stations to identify required items...");
    const stationsResponse = await getHideoutStations();
    const requiredItemIds = new Set<string>();

    stationsResponse.data.stations.forEach((station) => {
        station.levels.forEach((level) => {
            level.itemRequirements.forEach((req) => {
                requiredItemIds.add(req.item.id);
            });
        });
    });

    const queryIds = Array.from(requiredItemIds);
    console.log(`Identified ${queryIds.length} unique items required for hideout.`);

    if (queryIds.length === 0) {
        const updatedAt = Date.now();
        const body: TimedResponse<ItemsPayload> = {
            data: { items: [] },
            updatedAt,
        };
        return body;
    }

    // 3. Fetch ONLY required items from Tarkov.dev
    console.log(`Fetching ${queryIds.length} specific items from Tarkov.dev...`);
    const fetchOptions: RequestInit = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: ITEMS_QUERY,
            variables: { ids: queryIds },
        }),
    };

    if (options?.revalidateSeconds && options.revalidateSeconds > 0) {
        fetchOptions.next = { revalidate: options.revalidateSeconds };
    } else {
        fetchOptions.cache = "no-store";
    }

    let res: Response;
    try {
        res = await fetch(TARKOV_GRAPHQL_ENDPOINT, fetchOptions);
    } catch (error) {
        console.error("Tarkov.dev items fetch threw", error);
        if (cached) {
            console.log("Using stale cached items due to fetch error");
            return cached;
        }
        throw error;
    }

    let items: ItemDetails[] = [];

    if (!res.ok) {
        const text = await res.text();
        console.error("Tarkov.dev items error", res.status, text);
        // Fallback to stale cache
        if (cached) {
            console.log("Using stale cached items due to upstream error");
            return cached;
        }

        throw new Error("Failed to fetch items");
    } else {
        const json = (await res.json()) as TarkovItemsResponse;
        const upstreamItems = json.data?.items;
        if (json.errors?.length || !Array.isArray(upstreamItems) || upstreamItems.length === 0) {
            console.error("Tarkov.dev items returned invalid GraphQL data", json.errors);
            if (cached) return cached;
            throw new Error("Tarkov.dev returned no items");
        }
        items = upstreamItems;
    }

    // 4. Cache the filtered result
    const payload: ItemsPayload = { items };

    const updatedAt = Date.now();

    const body: TimedResponse<ItemsPayload> = {
        data: payload,
        updatedAt,
    };

    const jsonBody = JSON.stringify(body);
    await redis.mset({
        [REDIS_KEY]: jsonBody,
        [REDIS_KEY_META]: { updatedAt },
    });

    console.log(`Cached ${items.length} filtered items.`);

    return body;
}

export const getCachedHideoutRequiredItems = unstable_cache(
    async () => getHideoutRequiredItems(),
    ["hideout-required-items"],
    // Invalidate on demand via /api/revalidate?tag=hideout-data.
    { revalidate: 14 * 24 * 60 * 60, tags: ["hideout-data"] },
);
