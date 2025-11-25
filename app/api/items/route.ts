import { NextResponse } from "next/server";
import type { ItemsPayload, TimedResponse, ItemDetails } from "@/app/types";
import { redis } from "@/app/server/redis";
import { getHideoutStations } from "@/app/server/services/hideout";

const CACHE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
const REDIS_KEY = "hideout:items:filtered:v1";
const REDIS_KEY_META = `${REDIS_KEY}:meta`;
const TARKOV_GRAPHQL_ENDPOINT = "https://api.tarkov.dev/graphql";

const SIX_HOURS_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=21600",
    "CDN-Cache-Control": "public, s-maxage=21600",
};

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
        // 1. Try Redis cache first for ALREADY FILTERED items
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
            console.log("Using cached filtered items");
            // If already object (Upstash), return as is
            if (typeof cachedBody === "object") {
                return NextResponse.json(cachedBody, {
                    headers: SIX_HOURS_CACHE_HEADERS,
                });
            }
            // Return string directly
            return new NextResponse(cachedBody, {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    ...SIX_HOURS_CACHE_HEADERS,
                },
            });
        }

        // 2. Fetch Stations to determine required Item IDs
        console.log("Cache stale or missing. Fetching stations to identify required items...");
        const stations = await getHideoutStations();
        const requiredItemIds = new Set<string>();

        stations.forEach((station) => {
            station.levels.forEach((level) => {
                level.itemRequirements.forEach((req) => {
                    requiredItemIds.add(req.item.id);
                });
            });
        });

        const queryIds = Array.from(requiredItemIds);
        console.log(`Identified ${queryIds.length} unique items required for hideout.`);

        if (queryIds.length === 0) {
            return NextResponse.json(
                { data: { items: [] }, updatedAt: Date.now() },
                {
                    headers: SIX_HOURS_CACHE_HEADERS,
                }
            );
        }

        // 3. Fetch ONLY required items from Tarkov.dev
        console.log(`Fetching ${queryIds.length} specific items from Tarkov.dev...`);
        const res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: ITEMS_QUERY,
                variables: { ids: queryIds },
            }),
            cache: "no-store",
        });

        let items: ItemDetails[] = [];

        if (!res.ok) {
            const text = await res.text();
            console.error("Tarkov.dev items error", res.status, text);
            // Fallback to stale cache
            if (cachedBody) {
                console.log("Using stale cached items due to upstream error");
                if (typeof cachedBody === "object") {
                    return NextResponse.json(cachedBody, {
                        headers: SIX_HOURS_CACHE_HEADERS,
                    });
                }
                return new NextResponse(cachedBody, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        ...SIX_HOURS_CACHE_HEADERS,
                    },
                });
            }
            return NextResponse.json({ error: "Failed to fetch items" }, { status: 502 });
        } else {
            const json = (await res.json()) as TarkovItemsResponse;
            items = json.data?.items ?? [];
        }

        // 4. Cache the filtered result
        const payload: ItemsPayload = { items };
        const body: TimedResponse<ItemsPayload> = {
            data: payload,
            updatedAt: Date.now(),
        };

        const jsonBody = JSON.stringify(body);
        await redis.mset({
            [REDIS_KEY]: jsonBody,
            [REDIS_KEY_META]: { updatedAt: Date.now() },
        });

        console.log(`Cached ${items.length} filtered items.`);

        return new NextResponse(jsonBody, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                ...SIX_HOURS_CACHE_HEADERS,
            },
        });
    } catch (error) {
        console.error("/api/items unexpected error", error);
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
}
