import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { buildQuestAnyOfGroups, buildQuestItemIndex } from "@/lib/utils/quest-item-index";
import { redis } from "@/server/redis";
import { getJsonHideoutRequiredItems } from "@/server/services/itemsJson";
import { getCachedJsonFullQuestData } from "@/server/services/questsJson";
import { orderQuestsByPrerequisites } from "@/server/services/quests";
import {
    fetchTarkovJsonDataset,
    type TarkovJsonGameMode,
} from "@/server/services/tarkovJson/client";
import type { GameMode } from "@/server/services/marketPrices";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import type { MarketPrice } from "@/types";
import { excludeRemovedQuests } from "@/lib/utils/removed-quests";

const FILTERED_PRICES_KEY_PREFIX = `item-market-data:filtered:v${CACHE_VERSIONS.marketPrices}`;

interface JsonMarketItem {
    id: string;
    normalizedName: string;
    avg24hPrice?: number | null;
    high24hPrice?: number | null;
    low24hPrice?: number | null;
    lastLowPrice?: number | null;
    lastOfferCount?: number | null;
    changeLast48hPercent?: number | null;
    sellToTrader?: Array<{
        trader: string;
        currency: string;
        price: number;
        priceRUB: number;
    }>;
}

interface JsonItemsData {
    items: Record<string, JsonMarketItem>;
}

interface JsonTrader {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string | null;
}

interface PriceTrackedItem {
    id: string;
    normalizedName: string;
}

export interface RefreshTarkovJsonMarketPricesResult {
    mode: GameMode;
    itemCount: number;
    updatedAt: number;
}

function buildFilteredKeys(mode: GameMode) {
    const baseKey = `${FILTERED_PRICES_KEY_PREFIX}:${mode.toLowerCase()}`;
    return { bodyKey: baseKey, metaKey: `${baseKey}:meta` };
}

async function getPriceTrackedItems(gameMode: TarkovJsonGameMode): Promise<PriceTrackedItem[]> {
    const [{ data: hideoutItems }, questsResponse] = await Promise.all([
        getJsonHideoutRequiredItems(undefined, gameMode),
        getCachedJsonFullQuestData(gameMode),
    ]);
    const tracked = new Map<string, PriceTrackedItem>();

    for (const item of hideoutItems.items) {
        if (item.id && item.normalizedName) {
            tracked.set(item.id, { id: item.id, normalizedName: item.normalizedName });
        }
    }

    const quests = orderQuestsByPrerequisites(
        excludeRemovedQuests(questsResponse.data.quests),
    );
    for (const item of buildQuestItemIndex(quests)) {
        if (item.itemId && item.normalizedName) {
            tracked.set(item.itemId, { id: item.itemId, normalizedName: item.normalizedName });
        }
    }
    for (const group of buildQuestAnyOfGroups(quests)) {
        for (const item of group.items) {
            if (item.id && item.normalizedName) {
                tracked.set(item.id, { id: item.id, normalizedName: item.normalizedName });
            }
        }
    }
    return [...tracked.values()];
}

export async function refreshTarkovJsonMarketPrices(
    mode: GameMode,
): Promise<RefreshTarkovJsonMarketPricesResult> {
    const gameMode = toTarkovJsonGameMode(mode);
    const [requiredItems, itemsDataset, tradersDataset] = await Promise.all([
        getPriceTrackedItems(gameMode),
        fetchTarkovJsonDataset<JsonItemsData>("items", gameMode),
        fetchTarkovJsonDataset<Record<string, JsonTrader>>("traders", gameMode),
    ]);
    if (requiredItems.length === 0) {
        throw new Error(`Refusing to overwrite ${mode} market cache with no tracked items`);
    }

    const filtered: Record<string, MarketPrice | null> = {};
    for (const requiredItem of requiredItems) {
        const item = itemsDataset.data.items[requiredItem.id];
        if (!item) {
            filtered[requiredItem.normalizedName] = null;
            continue;
        }

        filtered[requiredItem.normalizedName] = {
            price: item.lastLowPrice,
            avg24hPrice: item.avg24hPrice,
            high24hPrice: item.high24hPrice,
            low24hPrice: item.low24hPrice,
            lastLowPrice: item.lastLowPrice,
            lastOfferCount: item.lastOfferCount,
            changeLast48hPercent: item.changeLast48hPercent,
            diff24h: item.changeLast48hPercent,
            sellFor: (item.sellToTrader ?? []).map((offer) => {
                const trader = tradersDataset.data[offer.trader];
                return {
                    vendor: {
                        name: tradersDataset.translate(trader?.name ?? offer.trader),
                        normalizedName: trader?.normalizedName ?? offer.trader,
                        imageLink: trader?.imageLink ?? null,
                    },
                    currency: offer.currency,
                    price: offer.price,
                    priceRUB: offer.priceRUB,
                };
            }),
        };
    }

    if (Object.keys(filtered).length === 0) {
        throw new Error(`Refusing to overwrite ${mode} market cache with an empty response`);
    }

    const updatedAt = Date.now();
    const { bodyKey, metaKey } = buildFilteredKeys(mode);
    await redis.mset({
        [bodyKey]: JSON.stringify(filtered),
        [metaKey]: { updatedAt },
    });
    return { mode, itemCount: Object.keys(filtered).length, updatedAt };
}
