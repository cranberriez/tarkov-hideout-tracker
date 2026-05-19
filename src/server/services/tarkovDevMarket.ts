import { redis } from "@/server/redis";
import { getHideoutRequiredItems } from "@/server/services/items";
import { getCachedFullQuestData, orderQuestsByPrerequisites } from "@/server/services/quests";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { buildQuestAnyOfGroups, buildQuestItemIndex } from "@/lib/utils/quest-item-index";
import type { MarketPrice } from "@/types";
import type { GameMode } from "@/server/services/marketPrices";

const TARKOV_GRAPHQL_ENDPOINT = "https://api.tarkov.dev/graphql";
const FILTERED_PRICES_KEY_PREFIX = `item-market-data:filtered:v${CACHE_VERSIONS.marketPrices}`;
const ITEM_PRICE_BATCH_SIZE = 100;

type TarkovDevGameMode = "regular" | "pve";

interface RedisMeta {
    updatedAt: number;
}

interface TarkovDevMarketItem {
    id: string;
    normalizedName: string;
    avg24hPrice: number | null;
    high24hPrice: number | null;
    low24hPrice: number | null;
    lastLowPrice: number | null;
    lastOfferCount: number | null;
    changeLast48hPercent: number | null;
}

interface TarkovDevMarketResponse {
    data?: {
        items?: TarkovDevMarketItem[];
    };
    errors?: Array<{ message?: string }>;
}

interface RefreshTarkovDevMarketPricesResult {
    mode: GameMode;
    itemCount: number;
    updatedAt: number;
}

interface PriceTrackedItem {
    id: string;
    normalizedName: string;
}

const ITEM_FLEA_MARKET_QUERY = `
query ItemFleaMarketData($ids: [ID!]!, $gameMode: GameMode!) {
  items(ids: $ids, lang: en, gameMode: $gameMode) {
    id
    normalizedName
    avg24hPrice
    high24hPrice
    low24hPrice
    lastLowPrice
    lastOfferCount
    changeLast48hPercent
  }
}
`;

function toTarkovDevGameMode(mode: GameMode): TarkovDevGameMode {
    return mode === "PVE" ? "pve" : "regular";
}

function buildFilteredKeys(mode: GameMode) {
    const modeKey = mode.toLowerCase();
    const baseKey = `${FILTERED_PRICES_KEY_PREFIX}:${modeKey}`;
    return {
        bodyKey: baseKey,
        metaKey: `${baseKey}:meta`,
    };
}

function toMarketPrice(item: TarkovDevMarketItem): MarketPrice {
    return {
        price: item.lastLowPrice,
        avg24hPrice: item.avg24hPrice,
        high24hPrice: item.high24hPrice,
        low24hPrice: item.low24hPrice,
        lastLowPrice: item.lastLowPrice,
        lastOfferCount: item.lastOfferCount,
        changeLast48hPercent: item.changeLast48hPercent,
        diff24h: item.changeLast48hPercent,
    };
}

async function fetchTarkovDevMarketItems(
    ids: string[],
    mode: GameMode
): Promise<TarkovDevMarketItem[]> {
    const res = await fetch(TARKOV_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: ITEM_FLEA_MARKET_QUERY,
            variables: {
                ids,
                gameMode: toTarkovDevGameMode(mode),
            },
        }),
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `Failed to fetch Tarkov.dev flea market data for ${mode}: ${res.status} ${
                res.statusText
            } - ${text.slice(0, 300)}`
        );
    }

    const json = (await res.json()) as TarkovDevMarketResponse;

    if (json.errors?.length) {
        const messages = json.errors.map((error) => error.message).filter(Boolean).join("; ");
        throw new Error(`Tarkov.dev flea market query failed for ${mode}: ${messages}`);
    }

    return json.data?.items ?? [];
}

async function getPriceTrackedItems(): Promise<PriceTrackedItem[]> {
    const [{ data: hideoutItemsPayload }, questsResponse] = await Promise.all([
        getHideoutRequiredItems(),
        getCachedFullQuestData(),
    ]);

    const tracked = new Map<string, PriceTrackedItem>();

    for (const item of hideoutItemsPayload.items) {
        if (!item.id || !item.normalizedName) continue;
        tracked.set(item.id, { id: item.id, normalizedName: item.normalizedName });
    }

    const quests = orderQuestsByPrerequisites(questsResponse.data.quests);
    const questItemIndex = buildQuestItemIndex(quests);
    const questAnyOfGroups = buildQuestAnyOfGroups(quests);

    for (const item of questItemIndex) {
        if (!item.itemId || !item.normalizedName) continue;
        tracked.set(item.itemId, { id: item.itemId, normalizedName: item.normalizedName });
    }

    for (const group of questAnyOfGroups) {
        for (const item of group.items) {
            if (!item.id || !item.normalizedName) continue;
            tracked.set(item.id, { id: item.id, normalizedName: item.normalizedName });
        }
    }

    return Array.from(tracked.values());
}

export async function refreshTarkovDevMarketPrices(
    mode: GameMode
): Promise<RefreshTarkovDevMarketPricesResult> {
    const requiredItems = await getPriceTrackedItems();
    const requiredIds = Array.from(
        new Set(
            requiredItems
                .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
                .filter((id) => id.length > 0)
        )
    );
    const requiredNames = new Set(requiredItems.map((item) => item.normalizedName));

    if (requiredIds.length === 0) {
        const updatedAt = Date.now();
        const { bodyKey, metaKey } = buildFilteredKeys(mode);
        await redis.mset({
            [bodyKey]: JSON.stringify({}),
            [metaKey]: { updatedAt } satisfies RedisMeta,
        });
        return { mode, itemCount: 0, updatedAt };
    }

    const filtered: Record<string, MarketPrice | null> = {};

    for (let index = 0; index < requiredIds.length; index += ITEM_PRICE_BATCH_SIZE) {
        const batchIds = requiredIds.slice(index, index + ITEM_PRICE_BATCH_SIZE);
        const batchItems = await fetchTarkovDevMarketItems(batchIds, mode);
        for (const item of batchItems) {
            if (!item.normalizedName || !requiredNames.has(item.normalizedName)) continue;
            filtered[item.normalizedName] = toMarketPrice(item);
        }
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

    return {
        mode,
        itemCount: Object.keys(filtered).length,
        updatedAt,
    };
}
