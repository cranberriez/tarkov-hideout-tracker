import { NextResponse } from "next/server";
import type {
    ItemsPricesPayload,
    TimedResponse,
    ItemPrice,
    HideoutStationsPayload,
} from "@/app/types";
import { redis } from "@/app/server/redis";

const CACHE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const PRICE_CACHE_KEY = "items:prices:v1";
const HIDEOUT_CACHE_KEY = "hideout:stations:v1";
const TARKOV_GRAPHQL_ENDPOINT = "https://api.tarkov.dev/graphql";

const ITEMS_PRICES_QUERY = `
query GetItemPrices($ids: [ID!]) {
  items(ids: $ids) {
    id
    name
    shortName
    iconLink
    gridImageLink
    avg24hPrice
    basePrice
    lastLowPrice
  }
}
`;

interface TarkovItemPrice {
    id: string;
    name: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
    avg24hPrice?: number;
    basePrice?: number;
    lastLowPrice?: number;
}

interface TarkovItemsResponse {
    data: {
        items: TarkovItemPrice[];
    };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const idsParam = searchParams.get("ids");

        // 1. Determine which IDs we need
        let targetIds: string[] = [];

        if (idsParam) {
            targetIds = idsParam
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean);
        } else {
            // If no IDs provided, check cache for ALL prices first
            // This is the "hot path" for the main app load
            const cachedPrices = await redis.get<TimedResponse<ItemsPricesPayload>>(
                PRICE_CACHE_KEY
            );

            if (cachedPrices && typeof cachedPrices === "object" && "updatedAt" in cachedPrices) {
                const age = Date.now() - cachedPrices.updatedAt;
                if (age < CACHE_WINDOW_MS) {
                    return NextResponse.json(cachedPrices, { status: 200 });
                }
            }

            // If cache miss/stale, we need to derive IDs from the hideout stations cache
            const hideoutCache = await redis.get<TimedResponse<HideoutStationsPayload>>(
                HIDEOUT_CACHE_KEY
            );

            if (hideoutCache?.data?.stations) {
                const idSet = new Set<string>();
                hideoutCache.data.stations.forEach((station) => {
                    station.levels.forEach((level) => {
                        level.itemRequirements.forEach((req) => {
                            if (req.item.id) idSet.add(req.item.id);
                        });
                    });
                });
                targetIds = Array.from(idSet);
            }
        }

        if (targetIds.length === 0) {
            // Fallback if we have no IDs to fetch (e.g. hideout cache empty)
            return NextResponse.json({ data: {}, updatedAt: Date.now() }, { status: 200 });
        }

        // 2. Fetch from Tarkov.dev
        const res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: ITEMS_PRICES_QUERY,
                variables: { ids: targetIds },
            }),
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("Tarkov.dev items error", res.status, await res.text());
            return NextResponse.json({ error: "Failed to fetch item prices" }, { status: 502 });
        }

        const json = (await res.json()) as TarkovItemsResponse;
        const items = json.data?.items || [];

        const priceMap: Record<string, ItemPrice> = {};
        for (const item of items) {
            priceMap[item.id] = {
                id: item.id,
                name: item.name,
                shortName: item.shortName,
                iconLink: item.iconLink,
                gridImageLink: item.gridImageLink,
                avg24hPrice: item.avg24hPrice,
                basePrice: item.basePrice,
                lastLowPrice: item.lastLowPrice,
            };
        }

        const responseBody: TimedResponse<ItemsPricesPayload> = {
            data: priceMap,
            updatedAt: Date.now(),
        };

        // 3. Update Cache (only if this was a full default fetch)
        if (!idsParam) {
            await redis.set(PRICE_CACHE_KEY, responseBody);
        }

        return NextResponse.json(responseBody, { status: 200 });
    } catch (error) {
        console.error("/api/items/prices unexpected error", error);
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
}
