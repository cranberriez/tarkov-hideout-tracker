import "server-only";

import { getCachedJsonHideoutStations } from "@/server/services/hideoutJson";
import { getBarterIndex, getCraftIndex } from "@/server/services/itemAcquisitionJson";
import { getGlobalItemList } from "@/server/services/itemsJson";
import { normalizePriceHistory } from "@/server/services/priceHistory";
import { getCachedJsonFullQuestData } from "@/server/services/questsJson";
import { TARKOV_API_HEADERS } from "@/server/services/tarkovApi";
import { getCachedJsonTraders } from "@/server/services/tradersJson";
import type { DataResult } from "@/types/common";
import type { ItemSummary } from "@/types/items";
import type { PriceHistoryPoint } from "@/types/prices";
import type { TarkovDataRepository } from "./types";

const PRICE_HISTORY_REVALIDATE_SECONDS = 900;

function resultWithData<TSource, TResult>(
    result: DataResult<TSource>,
    data: TResult,
): DataResult<TResult> {
    return {
        data,
        updatedAt: result.updatedAt,
        ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    };
}

function recordsByRequestedIds<T extends { id: string }>(
    records: readonly T[],
    ids: readonly string[],
): Record<string, T> {
    const requestedIds = new Set(ids);
    return Object.fromEntries(
        records
            .filter((record) => requestedIds.has(record.id))
            .map((record) => [record.id, record]),
    );
}

async function getCatalogByIds(
    mode: Parameters<TarkovDataRepository["items"]["getByIds"]>[0],
    ids: readonly string[],
) {
    const result = await getGlobalItemList(mode);
    return resultWithData(result, recordsByRequestedIds(result.data.items, ids));
}

async function getFullQuestsByIds(
    mode: Parameters<TarkovDataRepository["quests"]["getByIds"]>[0],
    ids: readonly string[],
) {
    // The current cache is a validated full-quest blob. Keeping this projection
    // private lets a future indexed repository replace it without changing callers.
    const result = await getCachedJsonFullQuestData(mode);
    return resultWithData(result, recordsByRequestedIds(result.data.quests, ids));
}

async function getTradersByIds(
    mode: Parameters<TarkovDataRepository["traders"]["getByIds"]>[0],
    ids: readonly string[],
) {
    const result = await getCachedJsonTraders(mode);
    return resultWithData(result, recordsByRequestedIds(result.data.traders, ids));
}

interface UpstreamPriceResponse {
    data?: unknown;
}

async function getPriceHistory(
    mode: Parameters<TarkovDataRepository["prices"]["getHistory"]>[0],
    itemId: string,
): Promise<DataResult<PriceHistoryPoint[]>> {
    const response = await fetch(
        `https://json.tarkov.dev/${mode}/prices/${encodeURIComponent(itemId)}`,
        {
            headers: TARKOV_API_HEADERS,
            next: { revalidate: PRICE_HISTORY_REVALIDATE_SECONDS },
        },
    );
    if (!response.ok) {
        throw new Error(`Price history request failed with status ${response.status}`);
    }

    const body = (await response.json()) as UpstreamPriceResponse;
    return {
        data: normalizePriceHistory(body.data),
        updatedAt: Date.now(),
        diagnostics: { provider: "json", upstreamStatus: "ok" },
    };
}

export const currentTarkovDataRepository: TarkovDataRepository = {
    items: {
        async getCatalog(mode) {
            const result = await getGlobalItemList(mode);
            return resultWithData(result, result.data.items);
        },
        getByIds: getCatalogByIds,
    },
    hideout: {
        async getStations(mode) {
            const result = await getCachedJsonHideoutStations(mode);
            return resultWithData(result, result.data.stations);
        },
    },
    quests: {
        async getAll(mode) {
            const result = await getCachedJsonFullQuestData(mode);
            return resultWithData(result, result.data.quests);
        },
        getByIds: getFullQuestsByIds,
    },
    traders: {
        async getAll(mode) {
            const result = await getCachedJsonTraders(mode);
            return resultWithData(result, result.data.traders);
        },
        getByIds: getTradersByIds,
    },
    recipes: {
        async getBarters(mode) {
            const result = await getBarterIndex(mode);
            return resultWithData(
                result,
                Object.values(result.data.bartersByItemId).flat(),
            );
        },
        async getCrafts(mode) {
            const result = await getCraftIndex(mode);
            return resultWithData(
                result,
                Object.values(result.data.craftsByItemId).flat(),
            );
        },
    },
    prices: {
        async getCurrent(mode, itemIds) {
            const result = await getGlobalItemList(mode);
            const itemsById = recordsByRequestedIds(result.data.items, itemIds);
            const prices = Object.fromEntries(
                Object.entries(itemsById).flatMap(([itemId, item]: [string, ItemSummary]) =>
                    item.marketPrice ? [[itemId, item.marketPrice]] : [],
                ),
            );
            return resultWithData(result, prices);
        },
        getHistory: getPriceHistory,
    },
};
