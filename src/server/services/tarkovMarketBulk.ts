import { redis } from "@/server/redis";
import { getHideoutRequiredItems } from "@/server/services/items";
import { normalizeNameForMatch, type TarkovMarketItem } from "@/server/services/tarkovMarket";
import type { MarketPrice } from "@/types";
import type { GameMode } from "@/server/services/marketPrices";

const FILTERED_PRICES_KEY_PREFIX = "tarkov-market:all-prices:filtered:v1";

interface RedisMeta {
    updatedAt: number;
}

function buildFilteredKeys(mode: GameMode) {
    const modeKey = mode.toLowerCase();
    const baseKey = `${FILTERED_PRICES_KEY_PREFIX}:${modeKey}`;
    return {
        bodyKey: baseKey,
        metaKey: `${baseKey}:meta`,
    };
}

function getBulkEndpoint(mode: GameMode): string {
    if (mode === "PVE") {
        return "https://api.tarkov-market.app/api/v1/pve/items/all";
    }
    return "https://api.tarkov-market.app/api/v1/items/all";
}

export async function refreshTarkovMarketPrices(mode: GameMode): Promise<void> {
    const apiKey = process.env.TARKOV_MARKET_KEY;
    if (!apiKey) {
        throw new Error("TARKOV_MARKET_KEY is not set in the environment");
    }

    const endpoint = getBulkEndpoint(mode);

    const res = await fetch(endpoint, {
        method: "GET",
        headers: {
            "x-api-key": apiKey,
            Accept: "application/json",
        },
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `Failed to fetch bulk Tarkov Market data for ${mode}: ${res.status} ${
                res.statusText
            } - ${text.slice(0, 300)}`
        );
    }

    const contentType = res.headers.get("content-type") || "";
    if (!/application\/json/i.test(contentType)) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `Unexpected content-type for bulk Tarkov Market data (${mode}): ${contentType} - ${text.slice(
                0,
                300
            )}`
        );
    }

    const items = (await res.json()) as TarkovMarketItem[];

    const { data: hideoutItemsPayload } = await getHideoutRequiredItems();
    const requiredItems = hideoutItemsPayload.items;
    const requiredNames = new Set(requiredItems.map((i) => i.normalizedName));

    const filtered: { [normalizedName: string]: MarketPrice | null } = {};

    for (const tm of items) {
        const key = normalizeNameForMatch(tm.name ?? tm.shortName ?? "");
        if (!key) continue;
        if (!requiredNames.has(key)) continue;

        filtered[key] = {
            price: tm.price,
            avg24hPrice: tm.avg24hPrice,
            avg7daysPrice: tm.avg7daysPrice,
            updated: tm.updated,
            link: tm.link,
            diff24h: tm.diff24h,
            traderName: tm.traderName,
            traderPrice: tm.traderPrice,
            traderPriceCur: tm.traderPriceCur,
        };
    }

    for (const name of requiredNames) {
        if (!(name in filtered)) {
            filtered[name] = null;
        }
    }

    const updatedAt = Date.now();
    const { bodyKey, metaKey } = buildFilteredKeys(mode);

    await redis.mset({
        [bodyKey]: JSON.stringify(filtered),
        [metaKey]: { updatedAt } satisfies RedisMeta,
    });
}
