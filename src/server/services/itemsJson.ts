import { unstable_cache } from "next/cache";
import {
    cacheWhenEnabled,
    DATA_CACHE_MAX_AGE_MS,
    DATA_CACHE_REVALIDATE_SECONDS,
} from "@/server/cache";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { redis, writeRedisAfterResponse } from "@/server/redis";
import { getJsonHideoutStations } from "@/server/services/hideoutJson";
import { getCachedJsonFullQuestData } from "@/server/services/questsJson";
import {
    fetchTarkovJsonData,
    fetchTarkovJsonDataset,
} from "@/server/services/tarkovJson/client";
import type { TarkovJsonGameMode } from "@/server/services/tarkovJson/client";
import {
    markStaleFallback,
    parseNonEmptyTimedResponse,
} from "@/server/services/tarkovJson/cache";
import { excludeRemovedQuests } from "@/lib/utils/removed-quests";
import type {
    FullQuestObjective,
    ItemAmount,
    ItemCraftRecipe,
    ItemDetails,
    ItemTraderOffer,
    ItemsPayload,
    MarketPrice,
    QuestItem,
    TimedResponse,
} from "@/types";

interface JsonItemCategory {
    id: string;
    name: string;
    normalizedName: string;
}

interface JsonMarketItem {
    id: string;
    name: string;
    shortName?: string;
    normalizedName: string;
    description?: string;
    updated?: string;
    width?: number;
    height?: number;
    weight?: number;
    types?: string[];
    iconLink?: string;
    gridImageLink?: string;
    baseImageLink?: string;
    inspectImageLink?: string;
    image512pxLink?: string;
    image8xLink?: string;
    link?: string;
    wikiLink?: string;
    basePrice?: number | null;
    categories?: string[];
    minLevelForFlea?: number | null;
    avg24hPrice?: number | null;
    high24hPrice?: number | null;
    low24hPrice?: number | null;
    lastLowPrice?: number | null;
    lastOfferCount?: number | null;
    changeLast48h?: number | null;
    changeLast48hPercent?: number | null;
    lastScan?: string | null;
    sellToTrader?: Array<{
        trader: string;
        currency: string;
        price: number;
        priceRUB: number;
    }>;
}

interface JsonItemsData {
    items: Record<string, JsonMarketItem>;
    itemCategories?: Record<string, JsonItemCategory>;
}

interface JsonTrader {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string | null;
}

interface JsonContainedItem {
    item: string;
    count?: number;
    attributes?: { tool?: boolean };
}

interface JsonBarter {
    id: string;
    trader: string;
    taskUnlock?: string | null;
    requiredItems?: JsonContainedItem[];
    minTraderLevel?: number;
    offeredItem: JsonContainedItem;
    buyLimit?: number | null;
}

interface JsonCraft {
    id: string;
    station: string;
    level?: number;
    duration?: number;
    taskUnlock?: string | null;
    requiredItems?: JsonContainedItem[];
    requiredQuestItems?: JsonContainedItem[];
    gameEditions?: string[];
    productItem: JsonContainedItem;
}

function toItemAmount(
    containedItem: JsonContainedItem,
    items: Record<string, JsonMarketItem>,
    translateItem: (key: string | null | undefined) => string,
): ItemAmount {
    const item = items[containedItem.item];
    return {
        item: {
            id: containedItem.item,
            name: item ? translateItem(item.name) : "Quest item",
            normalizedName: item?.normalizedName ?? containedItem.item,
            iconLink: item?.iconLink,
            gridImageLink: item?.gridImageLink,
        },
        count: containedItem.count ?? 1,
        isTool: containedItem.attributes?.tool === true,
    };
}

function indexTraderOffers(
    barters: JsonBarter[],
    items: Record<string, JsonMarketItem>,
    traders: Record<string, JsonTrader>,
    questsById: Map<string, { id: string; name: string; wikiLink?: string | null }>,
    translateItem: (key: string | null | undefined) => string,
    translateTrader: (key: string | null | undefined) => string,
) {
    const byItemId = new Map<string, ItemTraderOffer[]>();
    for (const barter of barters) {
        const trader = traders[barter.trader];
        const taskUnlock = barter.taskUnlock
            ? (questsById.get(barter.taskUnlock) ?? {
                  id: barter.taskUnlock,
                  name: "Quest unlock",
              })
            : null;
        const offer: ItemTraderOffer = {
            id: barter.id,
            trader: {
                id: barter.trader,
                name: translateTrader(trader?.name ?? barter.trader),
                normalizedName: trader?.normalizedName ?? barter.trader,
                imageLink: trader?.imageLink,
            },
            minTraderLevel: barter.minTraderLevel ?? 1,
            taskUnlock,
            requiredItems: (barter.requiredItems ?? []).map((item) =>
                toItemAmount(item, items, translateItem),
            ),
            offeredCount: barter.offeredItem.count ?? 1,
            buyLimit: barter.buyLimit,
        };
        const offers = byItemId.get(barter.offeredItem.item) ?? [];
        offers.push(offer);
        byItemId.set(barter.offeredItem.item, offers);
    }
    return byItemId;
}

function indexCrafts(
    crafts: JsonCraft[],
    items: Record<string, JsonMarketItem>,
    stations: Array<{ id: string; name: string; normalizedName: string; imageLink?: string }>,
    questsById: Map<string, { id: string; name: string; wikiLink?: string | null }>,
    translateItem: (key: string | null | undefined) => string,
) {
    const stationsById = new Map(stations.map((station) => [station.id, station]));
    const byItemId = new Map<string, ItemCraftRecipe[]>();
    for (const craft of crafts) {
        const station = stationsById.get(craft.station);
        const taskUnlock = craft.taskUnlock
            ? (questsById.get(craft.taskUnlock) ?? {
                  id: craft.taskUnlock,
                  name: "Quest unlock",
              })
            : null;
        const recipe: ItemCraftRecipe = {
            id: craft.id,
            station: station ?? {
                id: craft.station,
                name: "Unknown station",
                normalizedName: craft.station,
            },
            level: craft.level ?? 1,
            duration: craft.duration ?? 0,
            taskUnlock,
            requiredItems: (craft.requiredItems ?? []).map((item) =>
                toItemAmount(item, items, translateItem),
            ),
            requiredQuestItems: (craft.requiredQuestItems ?? []).map((item) =>
                toItemAmount(item, items, translateItem),
            ),
            gameEditions: craft.gameEditions ?? [],
            productCount: craft.productItem.count ?? 1,
        };
        const recipes = byItemId.get(craft.productItem.item) ?? [];
        recipes.push(recipe);
        byItemId.set(craft.productItem.item, recipes);
    }
    return byItemId;
}

function readUpdatedAt(meta: unknown): number | null {
    if (!meta) return null;
    let parsed: unknown;
    try {
        parsed = typeof meta === "string" ? JSON.parse(meta) : meta;
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object" || !("updatedAt" in parsed)) return null;
    const updatedAt = (parsed as { updatedAt?: unknown }).updatedAt;
    return typeof updatedAt === "number" ? updatedAt : null;
}

function isItemCacheFresh(meta: unknown): boolean {
    const updatedAt = readUpdatedAt(meta);
    return updatedAt !== null && Date.now() - updatedAt < DATA_CACHE_MAX_AGE_MS;
}

function addQuestObjectiveItems(
    objective: FullQuestObjective,
    itemsById: Map<string, ItemDetails>,
) {
    const add = (item: QuestItem | undefined | null) => {
        if (item) itemsById.set(item.id, item);
    };

    if ("items" in objective && Array.isArray(objective.items)) {
        objective.items.forEach(add);
    }
    objective.requiredKeys?.flat().forEach(add);
    if ("questItem" in objective) add(objective.questItem);
    if ("item" in objective) add(objective.item);
    if ("containsAll" in objective) objective.containsAll.forEach(add);
    if ("useAny" in objective) objective.useAny.forEach(add);
}

function toMarketPrice(
    item: JsonMarketItem,
    traders: Record<string, JsonTrader>,
    translateTrader: (key: string | null | undefined) => string,
): MarketPrice {
    const parsedLastScan = item.lastScan ? Date.parse(item.lastScan) : Number.NaN;
    return {
        price: item.lastLowPrice,
        avg24hPrice: item.avg24hPrice,
        high24hPrice: item.high24hPrice,
        low24hPrice: item.low24hPrice,
        lastLowPrice: item.lastLowPrice,
        lastOfferCount: item.lastOfferCount,
        changeLast48h: item.changeLast48h,
        changeLast48hPercent: item.changeLast48hPercent,
        diff24h: item.changeLast48hPercent,
        updatedAt: Number.isNaN(parsedLastScan) ? null : parsedLastScan,
        sellFor: (item.sellToTrader ?? []).map((offer) => {
            const trader = traders[offer.trader];
            return {
                vendor: {
                    name: translateTrader(trader?.name ?? offer.trader),
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

function toItemDetails(
    item: JsonMarketItem,
    categories: Record<string, JsonItemCategory>,
    traders: Record<string, JsonTrader>,
    translateItem: (key: string | null | undefined) => string,
    translateTrader: (key: string | null | undefined) => string,
): ItemDetails {
    const mappedCategories = (item.categories ?? [])
        .map((id) => categories[id])
        .filter((category): category is JsonItemCategory => Boolean(category))
        .map((category) => ({
            id: category.id,
            name: translateItem(category.name),
            normalizedName: category.normalizedName,
        }));

    return {
        id: item.id,
        name: translateItem(item.name),
        normalizedName: item.normalizedName,
        shortName: item.shortName ? translateItem(item.shortName) : undefined,
        description: item.description ? translateItem(item.description) : undefined,
        updated: item.updated,
        width: item.width,
        height: item.height,
        weight: item.weight,
        types: item.types,
        iconLink: item.iconLink,
        gridImageLink: item.gridImageLink,
        baseImageLink: item.baseImageLink,
        inspectImageLink: item.inspectImageLink,
        image512pxLink: item.image512pxLink,
        image8xLink: item.image8xLink,
        link: item.link,
        wikiLink: item.wikiLink,
        basePrice: item.basePrice,
        minLevelForFlea: item.minLevelForFlea,
        category: mappedCategories.at(-1),
        categories: mappedCategories,
        marketPrice: toMarketPrice(item, traders, translateTrader),
    };
}

function buildRedisKeys(gameMode: TarkovJsonGameMode) {
    const bodyKey = `hideout:items:filtered:v${CACHE_VERSIONS.hideoutItems}:${gameMode}`;
    return { bodyKey, metaKey: `${bodyKey}:meta` };
}

export interface GetJsonHideoutRequiredItemsOptions {
    revalidateSeconds?: number;
}

export async function getJsonHideoutRequiredItems(
    options?: GetJsonHideoutRequiredItemsOptions,
    gameMode: TarkovJsonGameMode = "regular",
): Promise<TimedResponse<ItemsPayload>> {
    void options;
    const { bodyKey, metaKey } = buildRedisKeys(gameMode);
    const [cachedBody, cachedMeta] = await redis.mget<[unknown, unknown]>(
        bodyKey,
        metaKey,
    );
    const cached = parseNonEmptyTimedResponse<ItemsPayload>(cachedBody, (payload) => payload.items);

    if (cached && isItemCacheFresh(cachedMeta)) {
        console.log("Using cached tracked items");
        return cached;
    }

    try {
        const [
            stationsResponse,
            questsResponse,
            itemsDataset,
            tradersDataset,
            barters,
            crafts,
        ] =
            await Promise.all([
                getJsonHideoutStations(gameMode),
                getCachedJsonFullQuestData(gameMode),
                fetchTarkovJsonDataset<JsonItemsData>("items", gameMode),
                fetchTarkovJsonDataset<Record<string, JsonTrader>>("traders", gameMode),
                fetchTarkovJsonData<JsonBarter[]>("barters", gameMode),
                fetchTarkovJsonData<JsonCraft[]>("crafts", gameMode),
            ]);
        const fallbackItemsById = new Map<string, ItemDetails>();

        if (Object.keys(itemsDataset.data.items ?? {}).length === 0) {
            throw new Error("Tarkov JSON items response contained no items");
        }
        if (Object.keys(tradersDataset.data ?? {}).length === 0) {
            throw new Error("Tarkov JSON traders response contained no traders");
        }

        for (const station of stationsResponse.data.stations) {
            for (const level of station.levels) {
                for (const requirement of level.itemRequirements) {
                    fallbackItemsById.set(requirement.item.id, requirement.item);
                }
            }
        }

        for (const quest of excludeRemovedQuests(questsResponse.data.quests)) {
            for (const objective of quest.objectives) {
                addQuestObjectiveItems(objective, fallbackItemsById);
            }
        }

        const categories = itemsDataset.data.itemCategories ?? {};
        const questsById = new Map(
            questsResponse.data.quests.map((quest) => [
                quest.id,
                { id: quest.id, name: quest.name, wikiLink: quest.wikiLink },
            ]),
        );
        const traderOffersByItemId = indexTraderOffers(
            barters,
            itemsDataset.data.items,
            tradersDataset.data,
            questsById,
            itemsDataset.translate,
            tradersDataset.translate,
        );
        const craftsByItemId = indexCrafts(
            crafts,
            itemsDataset.data.items,
            stationsResponse.data.stations,
            questsById,
            itemsDataset.translate,
        );
        const items = [...fallbackItemsById].map(([id, fallback]) => {
            const item = itemsDataset.data.items[id];
            if (!item) return fallback;
            return {
                ...toItemDetails(
                      item,
                      categories,
                      tradersDataset.data,
                      itemsDataset.translate,
                      tradersDataset.translate,
                ),
                traderOffers: traderOffersByItemId.get(id) ?? [],
                crafts: craftsByItemId.get(id) ?? [],
            };
        });

        if (items.length === 0) {
            throw new Error("Tarkov JSON item mapping produced no tracked items");
        }

        const updatedAt = Date.now();
        const body: TimedResponse<ItemsPayload> = {
            data: { items },
            updatedAt,
            diagnostics: {
                provider: "json",
                localePaths: [
                    itemsDataset.locale.resolvedPath,
                    tradersDataset.locale.resolvedPath,
                ],
                usedRegularLocaleFallback:
                    itemsDataset.locale.usedRegularFallback ||
                    tradersDataset.locale.usedRegularFallback,
                upstreamStatus: "ok",
            },
        };
        await writeRedisAfterResponse({
            [bodyKey]: JSON.stringify(body),
            [metaKey]: { updatedAt },
        }, "tracked items");
        return body;
    } catch (error) {
        console.error("Failed to refresh tracked items from Tarkov JSON", error);
        if (cached) {
            console.log("Using stale cached items due to JSON upstream error");
            return markStaleFallback(cached);
        }
        throw error;
    }
}

const cachedJsonHideoutRequiredItems = unstable_cache(
    getJsonHideoutRequiredItems,
    ["json-hideout-required-items"],
    { revalidate: DATA_CACHE_REVALIDATE_SECONDS, tags: ["item-data", "hideout-data"] },
);

export const getCachedJsonHideoutRequiredItems = cacheWhenEnabled(
    getJsonHideoutRequiredItems,
    cachedJsonHideoutRequiredItems,
);
