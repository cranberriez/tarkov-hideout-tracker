import { NextResponse } from "next/server";
import type { ItemsPayload, TimedResponse, ItemDetails } from "@/app/types";
import { redis } from "@/app/server/redis";

const CACHE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const REDIS_KEY = "hideout:items:v4";
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
        // 1. Try Redis cache first
        const cached = await redis.get<TimedResponse<ItemsPayload>>(REDIS_KEY);

        if (cached && typeof cached === "object" && "updatedAt" in cached) {
            const age = Date.now() - cached.updatedAt;
            if (age < CACHE_WINDOW_MS) {
                console.log("Using cached items");
                return NextResponse.json(cached as TimedResponse<ItemsPayload>, {
                    status: 200,
                });
            }
        }

        // 2. Fetch from Tarkov.dev
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
            if (cached) {
                return NextResponse.json(cached as TimedResponse<ItemsPayload>, {
                    status: 200,
                });
            }
            return NextResponse.json({ error: "Failed to fetch items" }, { status: 502 });
        }

        const json = (await res.json()) as TarkovItemsResponse;
        const items = json.data?.items ?? [];

        const payload: ItemsPayload = { items };

        const body: TimedResponse<ItemsPayload> = {
            data: payload,
            updatedAt: Date.now(),
        };

        // 3. Store in Redis
        await redis.set(REDIS_KEY, body);

        return NextResponse.json(body, { status: 200 });
    } catch (error) {
        console.error("/api/items unexpected error", error);
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
}
