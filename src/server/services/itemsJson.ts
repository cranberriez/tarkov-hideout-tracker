import { unstable_cache } from "next/cache";
import { cacheWhenEnabled } from "@/server/cache";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { redis } from "@/server/redis";
import { getJsonHideoutStations } from "@/server/services/hideoutJson";
import { getCachedJsonFullQuestData } from "@/server/services/questsJson";
import { fetchTarkovJsonDataset } from "@/server/services/tarkovJson/client";
import type { TarkovJsonGameMode } from "@/server/services/tarkovJson/client";
import { parseNonEmptyTimedResponse } from "@/server/services/tarkovJson/cache";
import { excludeRemovedQuests } from "@/lib/utils/removed-quests";
import type {
    FullQuestObjective,
    ItemDetails,
    ItemsPayload,
    MarketPrice,
    QuestItem,
    TimedResponse,
} from "@/types";

const ITEM_DATA_REVALIDATE_SECONDS = 60 * 60;
const ITEM_DATA_MAX_AGE_MS = ITEM_DATA_REVALIDATE_SECONDS * 1000;

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
    return updatedAt !== null && Date.now() - updatedAt < ITEM_DATA_MAX_AGE_MS;
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
        const [stationsResponse, questsResponse, itemsDataset, tradersDataset] =
            await Promise.all([
                getJsonHideoutStations(gameMode),
                getCachedJsonFullQuestData(gameMode),
                fetchTarkovJsonDataset<JsonItemsData>("items", gameMode),
                fetchTarkovJsonDataset<Record<string, JsonTrader>>("traders", gameMode),
            ]);
        const fallbackItemsById = new Map<string, ItemDetails>();

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
        const items = [...fallbackItemsById].map(([id, fallback]) => {
            const item = itemsDataset.data.items[id];
            return item
                ? toItemDetails(
                      item,
                      categories,
                      tradersDataset.data,
                      itemsDataset.translate,
                      tradersDataset.translate,
                  )
                : fallback;
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
            },
        };
        await redis.mset({
            [bodyKey]: JSON.stringify(body),
            [metaKey]: { updatedAt },
        });
        return body;
    } catch (error) {
        console.error("Failed to refresh tracked items from Tarkov JSON", error);
        if (cached) {
            console.log("Using stale cached items due to JSON upstream error");
            return cached;
        }
        throw error;
    }
}

const cachedJsonHideoutRequiredItems = unstable_cache(
    getJsonHideoutRequiredItems,
    ["json-hideout-required-items"],
    { revalidate: ITEM_DATA_REVALIDATE_SECONDS, tags: ["item-data", "hideout-data"] },
);

export const getCachedJsonHideoutRequiredItems = cacheWhenEnabled(
    getJsonHideoutRequiredItems,
    cachedJsonHideoutRequiredItems,
);
