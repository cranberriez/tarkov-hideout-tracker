import { NextResponse } from "next/server";
import type { ItemsPayload, TimedResponse, ItemDetails } from "@/app/types";
import { redis } from "@/app/server/redis";
import { getHideoutStations } from "@/app/server/services/hideout";

const CACHE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
const REDIS_KEY = "hideout:items:v5";
const REDIS_KEY_META = `${REDIS_KEY}:meta`;
const TARKOV_GRAPHQL_ENDPOINT = "https://api.tarkov.dev/graphql";

interface TarkovItemsResponse {
    data: {
        items: ItemDetails[];
    };
}

const ITEMS_QUERY = `
{
  items(lang: en) {
    id
    name
    normalizedName
    iconLink
    gridImageLink
    avg24hPrice
    lastLowPrice
    changeLast48h
    category {
      name
      normalizedName
    }
    sellFor {
      vendor {
        name
        normalizedName
      }
      currency
      price
      priceRUB
    }
    low24hPrice
    link
    wikiLink
  }
}
`;

export async function GET() {
    try {
        // 1. Get all items (Cached or Fresh)
        let allItems: ItemDetails[] = [];

        // Try Redis cache first for ALL items
        const [cachedBody, cachedMeta] = await redis.mget<[string, { updatedAt: number }]>(
            REDIS_KEY,
            REDIS_KEY_META
        );

        let isFresh = false;
        if (cachedBody && cachedMeta && typeof cachedMeta === "object") {
            const age = Date.now() - cachedMeta.updatedAt;
            if (age < CACHE_WINDOW_MS) {
                isFresh = true;
            }
        }

        if (isFresh && cachedBody) {
            console.log("Using cached items");
            const body =
                typeof cachedBody === "object"
                    ? cachedBody
                    : (JSON.parse(cachedBody) as TimedResponse<ItemsPayload>);
            allItems = body.data.items;
        } else {
            // Fetch from Tarkov.dev
            console.log("Fetching fresh items from Tarkov.dev");
            const res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query: ITEMS_QUERY }),
                cache: "no-store",
            });

            if (!res.ok) {
                const text = await res.text();
                console.error("Tarkov.dev items error", res.status, text);
                // Fallback to stale cache
                if (cachedBody) {
                    console.log("Using stale cached items due to upstream error");
                    const body =
                        typeof cachedBody === "object"
                            ? cachedBody
                            : (JSON.parse(cachedBody) as TimedResponse<ItemsPayload>);
                    allItems = body.data.items;
                } else {
                    return NextResponse.json({ error: "Failed to fetch items" }, { status: 502 });
                }
            } else {
                const json = (await res.json()) as TarkovItemsResponse;
                allItems = json.data?.items ?? [];

                // Store ALL items in Redis
                const payload: ItemsPayload = { items: allItems };
                const body: TimedResponse<ItemsPayload> = {
                    data: payload,
                    updatedAt: Date.now(),
                };

                await redis.mset({
                    [REDIS_KEY]: JSON.stringify(body),
                    [REDIS_KEY_META]: { updatedAt: Date.now() },
                });
            }
        }

        // 2. Filter items based on Hideout Requirements
        const stations = await getHideoutStations();
        const requiredItemIds = new Set<string>();

        stations.forEach((station) => {
            station.levels.forEach((level) => {
                level.itemRequirements.forEach((req) => {
                    requiredItemIds.add(req.item.id);
                });
            });
        });

        console.log(
            `Filtering items: ${allItems.length} total -> ${requiredItemIds.size} required`
        );

        const filteredItems = allItems.filter((item) => requiredItemIds.has(item.id));

        return NextResponse.json({
            data: { items: filteredItems },
            updatedAt: Date.now(),
        });
    } catch (error) {
        console.error("/api/items unexpected error", error);
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
}
