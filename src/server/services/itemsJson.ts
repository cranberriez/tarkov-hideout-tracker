import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { DATA_CACHE_MAX_AGE_MS } from "@/server/cache";
import { redis, writeRedisSequenceAfterResponse } from "@/server/redis";
import {
    fetchTarkovJsonDataset,
    type TarkovJsonDataset,
    type TarkovJsonGameMode,
} from "@/server/services/tarkovJson/client";
import { markStaleFallback } from "@/server/services/tarkovJson/cache";
import {
    ITEM_CATALOG_MANIFEST_SCHEMA,
    parseItemCatalogChunk,
    parseItemCatalogManifest,
    serializeItemCatalogChunks,
    type ItemCatalogManifest,
} from "@/server/services/itemCatalogCache";
import type {
    GlobalItem,
    GlobalItemMarketPrice,
    GlobalSkill,
    ItemCategory,
    ItemsPayload,
    SkillsPayload,
    TimedResponse,
} from "@/types";

interface JsonItemCategory { id: string; name: string; normalizedName: string }
interface JsonCatalogItem {
    id: string; name: string; normalizedName: string; shortName?: string;
    iconLink?: string; gridImageLink?: string; image512pxLink?: string;
    baseImageLink?: string; link?: string; wikiLink?: string; categories?: string[];
    minLevelForFlea?: number | null; avg24hPrice?: number | null;
    high24hPrice?: number | null; low24hPrice?: number | null;
    lastLowPrice?: number | null; lastOfferCount?: number | null;
    changeLast48hPercent?: number | null; lastScan?: string | null;
    sellToTrader?: Array<{ trader: string; priceRUB: number }>;
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

function buildRedisKeys(gameMode: TarkovJsonGameMode) {
    const manifestKey = `items:catalog:v${CACHE_VERSIONS.itemCatalog}:${gameMode}`;
    return { manifestKey, metaKey: `${manifestKey}:meta` };
}

function buildChunkKey(manifestKey: string, slot: 0 | 1, index: number) {
    return `${manifestKey}:slot:${slot}:chunk:${index}`;
}

async function readCachedCatalog(
    manifestKey: string,
    rawManifest: unknown,
): Promise<{
    manifest: ItemCatalogManifest;
    response: TimedResponse<ItemsPayload>;
} | null> {
    const manifest = parseItemCatalogManifest(rawManifest);
    if (!manifest) return null;

    const rawChunks = await Promise.all(
        Array.from({ length: manifest.chunkCount }, (_, index) =>
            redis.get<unknown>(buildChunkKey(manifestKey, manifest.slot, index)),
        ),
    );
    const chunks = rawChunks.map((chunk) =>
        parseItemCatalogChunk(chunk, manifest.generation),
    );
    if (chunks.some((chunk) => chunk === null)) return null;
    const items = chunks.flatMap((chunk) => chunk ?? []);
    if (items.length !== manifest.itemCount) return null;

    return {
        manifest,
        response: {
            data: { items },
            updatedAt: manifest.updatedAt,
            diagnostics: manifest.diagnostics,
        },
    };
}

function isFresh(meta: unknown) {
    try {
        const value = typeof meta === "string" ? JSON.parse(meta) : meta;
        const updatedAt = value && typeof value === "object" && "updatedAt" in value
            ? (value as { updatedAt?: unknown }).updatedAt : null;
        return typeof updatedAt === "number" && Date.now() - updatedAt < DATA_CACHE_MAX_AGE_MS;
    } catch { return false; }
}

function numberOrNullish(value: unknown): number | null | undefined {
    if (value === null) return null;
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapMarketPrice(
    item: JsonCatalogItem,
    traders: Record<string, JsonTrader>,
    translateTrader: (key: string | null | undefined) => string,
): GlobalItemMarketPrice {
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
): GlobalItem | null {
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
        // Tarkov.dev orders the category path from the most specific leaf to
        // generic parents. Keep only the leaf; repeating every parent on every
        // item materially inflates all catalog cache and RSC payloads.
        category,
        marketPrice: mapMarketPrice(item, traders, translateTrader),
    };
}

/** Complete mode-specific standard item catalog. Deliberately not wrapped in unstable_cache. */
export async function getGlobalItemList(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<TimedResponse<ItemsPayload>> {
    const { manifestKey, metaKey } = buildRedisKeys(gameMode);
    const [rawManifest, cachedMeta] = await redis.mget<[unknown, unknown]>(
        manifestKey,
        metaKey,
    );
    const cachedCatalog = await readCachedCatalog(manifestKey, rawManifest);
    const cached = cachedCatalog?.response ?? null;
    if (cached && isFresh(cachedMeta)) return cached;
    try {
        const [itemsDataset, tradersDataset] = await Promise.all([
            getItemsDataset(gameMode),
            fetchTarkovJsonDataset<Record<string, JsonTrader>>("traders", gameMode),
        ]);
        const sourceItems = Object.values(itemsDataset.data.items ?? {});
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
        if (sourceItems.length === 0 || items.length === 0) throw new Error("Global item mapping produced no items");
        const updatedAt = Date.now();
        const body: TimedResponse<ItemsPayload> = {
            data: { items }, updatedAt,
            diagnostics: {
                provider: "json",
                localePaths: [itemsDataset.locale.resolvedPath, tradersDataset.locale.resolvedPath],
                usedRegularLocaleFallback: itemsDataset.locale.usedRegularFallback || tradersDataset.locale.usedRegularFallback,
                upstreamStatus: "ok",
            },
        };
        const generation = `${updatedAt}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
        const slot: 0 | 1 = cachedCatalog?.manifest.slot === 0 ? 1 : 0;
        const chunks = serializeItemCatalogChunks(items, generation);
        if (chunks.length === 0) throw new Error("Global item catalog produced no Redis chunks");
        const manifest: ItemCatalogManifest = {
            schema: ITEM_CATALOG_MANIFEST_SCHEMA,
            generation,
            slot,
            chunkCount: chunks.length,
            itemCount: items.length,
            updatedAt,
            diagnostics: body.diagnostics,
        };
        await writeRedisSequenceAfterResponse(
            [
                ...chunks.map((chunk, index) => ({
                    [buildChunkKey(manifestKey, slot, index)]: chunk,
                })),
                {
                    [manifestKey]: JSON.stringify(manifest),
                    [metaKey]: { updatedAt },
                },
            ],
            "global item catalog",
        );
        return body;
    } catch (error) {
        console.error("Failed to refresh global item catalog", error);
        if (cached) return markStaleFallback(cached);
        throw error;
    }
}

/** Skills share the `/items` source but remain a compact hideout-only projection. */
export async function getGlobalSkillList(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<TimedResponse<SkillsPayload>> {
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

export const getJsonGlobalItemList = getGlobalItemList;
