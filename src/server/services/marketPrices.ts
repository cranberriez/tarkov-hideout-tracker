// Read-only price service that maps requested item normalizedNames to
// pre-filtered, bulk-fetched price blobs in Redis.
//
// The bulk data is populated by the cron-driven job in `tarkovDevMarket.ts`,
// which fetches Tarkov.dev item flea data for hideout-required and quest-required
// items and writes compact maps keyed by normalizedName. There are no direct HTTP
// calls in this read path.

import type { TimedResponse, MarketPrice } from "@/types";
import { redis } from "@/server/redis";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { unstable_cache } from "next/cache";

export type GameMode = "PVP" | "PVE";

const FILTERED_PRICES_KEY_PREFIX = `item-market-data:filtered:v${CACHE_VERSIONS.marketPrices}`;
const LEGACY_FILTERED_PRICES_KEY_PREFIX = "tarkov-market:all-prices:filtered:v1";

interface RedisMeta {
    updatedAt: number;
}

function buildFilteredKeys(mode: GameMode, prefix = FILTERED_PRICES_KEY_PREFIX) {
    const modeKey = mode.toLowerCase();
    const baseKey = `${prefix}:${modeKey}`;
    return {
        bodyKey: baseKey,
        metaKey: `${baseKey}:meta`,
    };
}

function parsePriceMap(cachedBody: unknown): { [normalizedName: string]: MarketPrice | null } {
    return typeof cachedBody === "object"
        ? (cachedBody as { [normalizedName: string]: MarketPrice | null })
        : (JSON.parse(String(cachedBody)) as { [normalizedName: string]: MarketPrice | null });
}

async function loadFilteredPrices(
    mode: GameMode
): Promise<TimedResponse<{ [normalizedName: string]: MarketPrice | null }>> {
    const { bodyKey, metaKey } = buildFilteredKeys(mode);
    const [cachedBody, cachedMeta] = await redis.mget<[string, RedisMeta]>(bodyKey, metaKey);

    if (cachedBody && cachedMeta && typeof cachedMeta === "object") {
        const data = parsePriceMap(cachedBody);
        if (Object.keys(data).length > 0) {
            return {
                data,
                updatedAt: cachedMeta.updatedAt ?? 0,
            };
        }
    }

    const legacyKeys = buildFilteredKeys(mode, LEGACY_FILTERED_PRICES_KEY_PREFIX);
    const [legacyBody, legacyMeta] = await redis.mget<[string, RedisMeta]>(
        legacyKeys.bodyKey,
        legacyKeys.metaKey
    );

    if (!legacyBody || !legacyMeta || typeof legacyMeta !== "object") {
        return {
            data: {},
            updatedAt: 0,
        };
    }

    const data = parsePriceMap(legacyBody);

    return {
        data,
        updatedAt: legacyMeta.updatedAt ?? 0,
    };
}

export async function getAllMarketPrices(
    gameMode: GameMode
): Promise<TimedResponse<{ [normalizedName: string]: MarketPrice | null }>> {
    const response = await loadFilteredPrices(gameMode);
    return {
        data: response.data,
        updatedAt: response.updatedAt || Date.now(),
    };
}

export async function getMarketPrices(
    normalizedNames: string[],
    gameMode: GameMode
): Promise<TimedResponse<{ [normalizedName: string]: MarketPrice | null }>> {
    const uniqueNames = Array.from(
        new Set(
            normalizedNames
                .map((name) => (typeof name === "string" ? name.trim() : ""))
                .filter((name) => name.length > 0)
        )
    );

    if (uniqueNames.length === 0) {
        return {
            data: {},
            updatedAt: Date.now(),
        };
    }

    const { data: allPrices, updatedAt } = await loadFilteredPrices(gameMode);

    const aggregated: { [normalizedName: string]: MarketPrice | null } = {};

    for (const name of uniqueNames) {
        aggregated[name] = Object.prototype.hasOwnProperty.call(allPrices, name)
            ? allPrices[name]
            : null;
    }

    return {
        data: aggregated,
        updatedAt: updatedAt || Date.now(),
    };
}

export const getCachedMarketPrices = unstable_cache(
    async (normalizedNames: string[], gameMode: GameMode) => {
        return getMarketPrices(normalizedNames, gameMode);
    },
    ["market-prices", `v${CACHE_VERSIONS.marketPrices}`],
    { revalidate: 5 * 60 }
);

export const getCachedAllMarketPrices = unstable_cache(
    async (gameMode: GameMode) => {
        return getAllMarketPrices(gameMode);
    },
    ["market-prices-all", `v${CACHE_VERSIONS.marketPrices}`],
    { revalidate: 5 * 60 }
);
