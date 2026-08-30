import { redis, writeRedisAfterResponse } from "@/server/redis";
import { CACHE_VERSIONS, PROGRESSION_DATA_FROZEN } from "@/lib/cfg/cacheVersions";
import type { Trader, TradersPayload, TimedResponse } from "@/types";
import { unstable_cache } from "next/cache";
import {
    DATA_CACHE_MAX_AGE_MS,
    DATA_CACHE_REVALIDATE_SECONDS,
} from "@/server/cache";
import { cacheWhenEnabled } from "@/server/cache";
import { TARKOV_GRAPHQL_HEADERS } from "@/server/services/tarkovApi";

const REDIS_KEY = `traders:all:v${CACHE_VERSIONS.traders}`;
const REDIS_KEY_META = `${REDIS_KEY}:meta`;
const TARKOV_GRAPHQL_ENDPOINT = "https://api.tarkov.dev/graphql";

const TRADERS_QUERY = `
query Traders {
  traders(lang: en) {
    id
    name
    normalizedName
    imageLink
    image4xLink
  }
}
`;

interface TradersApiResponse {
    data: { traders: Trader[] };
}

async function getTraders(): Promise<TimedResponse<TradersPayload>> {
    const [cachedBody, cachedMeta] = await redis.mget<[string, { updatedAt: number }]>(
        REDIS_KEY,
        REDIS_KEY_META,
    );

    if (cachedBody && cachedMeta && typeof cachedMeta === "object") {
        const age = Date.now() - cachedMeta.updatedAt;
        if (PROGRESSION_DATA_FROZEN || age < DATA_CACHE_MAX_AGE_MS) {
            console.log("Using cached trader data");
            if (typeof cachedBody === "object") return cachedBody as TimedResponse<TradersPayload>;
            return JSON.parse(cachedBody) as TimedResponse<TradersPayload>;
        }
    }

    console.log("Fetching fresh trader data from Tarkov.dev");
    const res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: TARKOV_GRAPHQL_HEADERS,
        body: JSON.stringify({ query: TRADERS_QUERY }),
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("Tarkov.dev traders error", res.status, text);
        if (cachedBody) {
            console.log("Using stale trader cache due to upstream error");
            const body = typeof cachedBody === "object" ? cachedBody : JSON.parse(cachedBody);
            return body as TimedResponse<TradersPayload>;
        }
        throw new Error("Failed to fetch trader data");
    }

    const json = (await res.json()) as TradersApiResponse;
    const traders: Trader[] = json.data?.traders ?? [];

    const payload: TradersPayload = { traders };
    const updatedAt = Date.now();
    const body: TimedResponse<TradersPayload> = { data: payload, updatedAt };

    await writeRedisAfterResponse({
        [REDIS_KEY]: JSON.stringify(body),
        [REDIS_KEY_META]: { updatedAt },
    }, "GraphQL traders");

    console.log(`Cached ${traders.length} traders`);

    return body;
}

const cachedTraders = unstable_cache(getTraders, ["traders"], {
    revalidate: DATA_CACHE_REVALIDATE_SECONDS,
    tags: ["quests"],
});

export const getCachedTraders = cacheWhenEnabled(getTraders, cachedTraders);
