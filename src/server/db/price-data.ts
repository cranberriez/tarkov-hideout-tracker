import type { DataResult, TarkovDataMode } from "@/types/common";
import type { CurrentPrice, PriceHistoryPoint, StoredCurrentPrice } from "@/types/prices";
import type { Client } from "@libsql/client";
import { getEntitiesByIds } from "./entity-data";
import {
    getMutableCurrentPricesByIds,
    isMissingMutablePriceStorage,
} from "./current-prices";
import { getTursoClient } from "./client";
import { getStoredPricePoints } from "@/server/prices/price-store";

export async function getCurrentPriceData(
    mode: TarkovDataMode,
    itemIds: readonly string[],
    database: Client = getTursoClient(),
): Promise<DataResult<Record<string, CurrentPrice>>> {
    const legacyResult = await getEntitiesByIds<CurrentPrice | null>(
        mode,
        "price",
        "items",
        itemIds,
        database,
    );
    let mutable: Record<string, StoredCurrentPrice> = {};
    try {
        mutable = await getMutableCurrentPricesByIds(mode, itemIds, database);
    } catch (error) {
        if (!isMissingMutablePriceStorage(error)) throw error;
    }
    const data = Object.fromEntries(
        itemIds.flatMap((itemId) => {
            const legacy = legacyResult.data[itemId];
            const current = mutable[itemId];
            if (!legacy && !current) return [];
            return [[itemId, {
                ...(legacy ?? {}),
                fleaStability: "reference",
                ...(current
                    ? {
                          price: current.effectivePrice,
                          referencePrice: current.latestPrice,
                          fleaStability: current.stability,
                          fleaPriceReasons: current.reasons,
                          fleaSampleCount: current.sampleCount,
                          lastLowPrice: current.latestPriceMin,
                          lastOfferCount: current.latestOfferCount,
                          changeLast48hPercent: undefined,
                          updatedAt: current.latestPointTimestamp,
                      }
                    : {}),
            } satisfies CurrentPrice]];
        }),
    );
    const latestMutableTimestamp = Object.values(mutable).reduce(
        (latest, price) => Math.max(latest, price.latestPointTimestamp),
        0,
    );
    return {
        data,
        updatedAt: latestMutableTimestamp || legacyResult.updatedAt,
    };
}

export async function getStoredPriceHistoryData(
    mode: TarkovDataMode,
    itemId: string,
): Promise<DataResult<PriceHistoryPoint[]>> {
    try {
        const result = await getStoredPricePoints(getTursoClient(), mode, itemId);
        return { data: result.points, updatedAt: result.updatedAt ?? Date.now() };
    } catch (error) {
        if (!isMissingMutablePriceStorage(error)) throw error;
        return { data: [], updatedAt: Date.now() };
    }
}
