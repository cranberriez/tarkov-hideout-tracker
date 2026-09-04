import {
    fetchTarkovJsonDataset,
    type TarkovJsonDataset,
    type TarkovJsonGameMode,
} from "@/server/services/tarkovJson/client";
import type { ItemSummary, ItemCategory } from "@/types/items";
import type { CurrentPrice } from "@/types/prices";
import type { GlobalSkill } from "@/types/hideout";
import type { ItemsPayload, SkillsPayload } from "@/types/contracts";
import type { DataResult } from "@/types/common";
import { isOnFleaMarket } from "@/lib/utils/flea-eligibility";

interface JsonItemCategory { id: string; name: string; normalizedName: string }
interface JsonCatalogItem {
    id: string; name: string; normalizedName: string; shortName?: string;
    iconLink?: string; gridImageLink?: string; image512pxLink?: string;
    baseImageLink?: string; link?: string; wikiLink?: string; categories?: string[];
    minLevelForFlea?: number | null; avg24hPrice?: number | null;
    high24hPrice?: number | null; low24hPrice?: number | null;
    lastLowPrice?: number | null; lastOfferCount?: number | null;
    changeLast48hPercent?: number | null; lastScan?: string | null;
    types?: string[];
    sellToTrader?: Array<{
        trader: string;
        price: number;
        priceRUB: number;
        currency: string;
    }>;
}
interface JsonSkill { id: string; name: string; imageLink?: string }
interface JsonItemsData {
    items: Record<string, JsonCatalogItem>;
    itemCategories?: Record<string, JsonItemCategory>;
    skills?: JsonSkill[];
}
interface JsonTrader {
    id: string; name: string; normalizedName: string; imageLink?: string | null;
}
const itemDatasetRequests = new Map<TarkovJsonGameMode, Promise<TarkovJsonDataset<JsonItemsData>>>();

async function getItemsDataset(gameMode: TarkovJsonGameMode) {
    let request = itemDatasetRequests.get(gameMode);
    if (!request) {
        request = fetchTarkovJsonDataset<JsonItemsData>("items", gameMode);
        itemDatasetRequests.set(gameMode, request);
    }
    try {
        return await request;
    } finally {
        itemDatasetRequests.delete(gameMode);
    }
}

function numberOrNullish(value: unknown): number | null | undefined {
    if (value === null) return null;
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapMarketPrice(
    item: JsonCatalogItem,
    traders: Record<string, JsonTrader>,
    translateTrader: (key: string | null | undefined) => string,
): CurrentPrice {
    const lastScan = item.lastScan ? Date.parse(item.lastScan) : Number.NaN;
    return {
        avg24hPrice: numberOrNullish(item.avg24hPrice),
        high24hPrice: numberOrNullish(item.high24hPrice),
        low24hPrice: numberOrNullish(item.low24hPrice),
        lastLowPrice: numberOrNullish(item.lastLowPrice),
        lastOfferCount: numberOrNullish(item.lastOfferCount),
        changeLast48hPercent: numberOrNullish(item.changeLast48hPercent),
        updatedAt: Number.isNaN(lastScan) ? null : lastScan,
        sellFor: (item.sellToTrader ?? []).flatMap((offer) => {
            if (typeof offer.trader !== "string" || !Number.isFinite(offer.priceRUB)) return [];
            const trader = traders[offer.trader];
            return [{
                vendor: {
                    id: offer.trader,
                    name: translateTrader(trader?.name ?? offer.trader),
                    normalizedName: trader?.normalizedName ?? offer.trader,
                    imageLink: trader?.imageLink,
                },
                price: numberOrNullish(offer.price) ?? offer.priceRUB,
                currency: offer.currency,
                priceRUB: offer.priceRUB,
            }];
        }),
    };
}

function mapItem(
    item: JsonCatalogItem,
    categories: Record<string, JsonItemCategory>,
    traders: Record<string, JsonTrader>,
    translateItem: (key: string | null | undefined) => string,
    translateTrader: (key: string | null | undefined) => string,
): ItemSummary | null {
    if (!item || typeof item.id !== "string" || !item.id || typeof item.name !== "string") return null;
    let category: ItemCategory | undefined;
    for (const categoryId of item.categories ?? []) {
        const sourceCategory = categories[categoryId];
        if (!sourceCategory) continue;
        category = {
            id: sourceCategory.id,
            name: translateItem(sourceCategory.name),
            normalizedName: sourceCategory.normalizedName,
        };
        break;
    }
    return {
        id: item.id,
        name: translateItem(item.name),
        normalizedName: item.normalizedName || item.id,
        shortName: item.shortName ? translateItem(item.shortName) : undefined,
        iconLink: item.iconLink,
        gridImageLink: item.gridImageLink,
        image512pxLink: item.image512pxLink,
        baseImageLink: item.baseImageLink,
        link: item.link,
        wikiLink: item.wikiLink,
        minLevelForFlea: numberOrNullish(item.minLevelForFlea),
        onFleaMarket: isOnFleaMarket(item.types ?? []),
        // Tarkov.dev orders the category path from the most specific leaf to
        // generic parents. Keep only the leaf; repeating every parent on every
        // item materially inflates all catalog cache and RSC payloads.
        category,
        marketPrice: mapMarketPrice(item, traders, translateTrader),
    };
}

/** Direct source reader used only while generating immutable database releases. */
export async function getGlobalItemList(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<DataResult<ItemsPayload>> {
    const [itemsDataset, tradersDataset] = await Promise.all([
        getItemsDataset(gameMode),
        fetchTarkovJsonDataset<Record<string, JsonTrader>>("traders", gameMode),
    ]);
    const sourceItems = Object.values(itemsDataset.data.items ?? {});
    if (sourceItems.some((item) => !Array.isArray(item.types))) {
        throw new Error("Tarkov JSON item dataset omitted flea eligibility types");
    }
    const items = sourceItems.flatMap((item) => {
        const mapped = mapItem(
            item,
            itemsDataset.data.itemCategories ?? {},
            tradersDataset.data,
            itemsDataset.translate,
            tradersDataset.translate,
        );
        return mapped ? [mapped] : [];
    });
    if (sourceItems.length === 0 || items.length === 0) {
        throw new Error("Global item mapping produced no items");
    }
    return {
        data: { items },
        updatedAt: Date.now(),
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
}

/** Skills share the `/items` source but remain a compact hideout-only projection. */
export async function getGlobalSkillList(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<DataResult<SkillsPayload>> {
    const dataset = await getItemsDataset(gameMode);
    const skills: GlobalSkill[] = (dataset.data.skills ?? []).flatMap((skill) =>
        typeof skill.id === "string" && skill.id
            ? [{ id: skill.id, name: dataset.translate(skill.name), imageLink: skill.imageLink }]
            : [],
    );
    if (skills.length === 0) throw new Error("Tarkov JSON item dataset contained no skills");
    return {
        data: { skills },
        updatedAt: Date.now(),
        diagnostics: {
            provider: "json",
            localePaths: [dataset.locale.resolvedPath],
            usedRegularLocaleFallback: dataset.locale.usedRegularFallback,
            upstreamStatus: "ok",
        },
    };
}
