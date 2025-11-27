import { redis } from "@/server/redis";
import { getHideoutStations } from "@/server/services/hideout";
import type { ItemsPayload, TimedResponse, ItemDetails } from "@/types";

const CACHE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
const REDIS_KEY = "hideout:items:filtered:v1";
const REDIS_KEY_META = `${REDIS_KEY}:meta`;
const TARKOV_GRAPHQL_ENDPOINT = "https://api.tarkov.dev/graphql";

interface TarkovItemsResponse {
    data: {
        items: ItemDetails[];
    };
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

    let isFresh = false;
    if (cachedBody && cachedMeta && typeof cachedMeta === "object") {
        const age = Date.now() - cachedMeta.updatedAt;
        if (age < CACHE_WINDOW_MS) {
            isFresh = true;
        }
    }

    if (isFresh && cachedBody) {
        console.log("Using cached filtered items");
        if (typeof cachedBody === "object") {
            return cachedBody as TimedResponse<ItemsPayload>;
        }
        return JSON.parse(cachedBody) as TimedResponse<ItemsPayload>;
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
    const fetchOptions: any = {
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

    const res = await fetch(TARKOV_GRAPHQL_ENDPOINT, fetchOptions);

    let items: ItemDetails[] = [];

    if (!res.ok) {
        const text = await res.text();
        console.error("Tarkov.dev items error", res.status, text);
        // Fallback to stale cache
        if (cachedBody) {
            console.log("Using stale cached items due to upstream error");
            if (typeof cachedBody === "object") {
                return cachedBody as TimedResponse<ItemsPayload>;
            }
            return JSON.parse(cachedBody) as TimedResponse<ItemsPayload>;
        }

        throw new Error("Failed to fetch items");
    } else {
        const json = (await res.json()) as TarkovItemsResponse;
        items = json.data?.items ?? [];
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
