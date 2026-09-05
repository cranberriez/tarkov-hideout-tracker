import type { Client } from "@libsql/client";
import type { TarkovDataMode } from "@/types/common";
import type { PriceHistoryPoint, StoredCurrentPrice } from "@/types/prices";
import { deriveEffectivePrice } from "@/lib/utils/price-history";
import { getTursoClient } from "./client";

export function isMissingMutablePriceStorage(error: unknown): boolean {
    return error instanceof Error && /no such table:\s*item_price/i.test(error.message);
}

export async function getMutableCurrentPricesByIds(
    mode: TarkovDataMode,
    itemIds: readonly string[],
    database: Client = getTursoClient(),
): Promise<Record<string, StoredCurrentPrice>> {
    if (itemIds.length === 0) return {};
    const result = await database.execute({
        sql: `
            SELECT
                item_id,
                effective_price,
                latest_price,
                latest_price_min,
                latest_offer_count,
                latest_point_timestamp,
                sample_count,
                total_offer_count,
                last_checked_at
            FROM item_prices
            WHERE mode = ?
                AND latest_point_timestamp IS NOT NULL
                AND item_id IN (SELECT value FROM json_each(?))
        `,
        args: [mode, JSON.stringify([...new Set(itemIds)])],
    });
    // One bounded batch read also upgrades pre-algorithm rows without a refresh,
    // including ETag/304 responses. Never trust an old weighted aggregate value.
    const history = await database.execute({
        sql: `SELECT item_id, timestamp, price, price_min, offer_count FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY timestamp DESC) AS rank
            FROM item_price_points WHERE mode = ?
                AND item_id IN (SELECT value FROM json_each(?))
        ) WHERE rank <= 10`,
        args: [mode, JSON.stringify([...new Set(itemIds)])],
    });
    const pointsById: Record<string, PriceHistoryPoint[]> = {};
    for (const row of history.rows) {
        if (typeof row.item_id !== "string" || row.price === null || row.price_min === null || row.timestamp === null) continue;
        (pointsById[row.item_id] ??= []).push({
            price: Number(row.price), priceMin: Number(row.price_min),
            timestamp: Number(row.timestamp),
            offerCount: row.offer_count === null ? null : Number(row.offer_count),
        });
    }
    return Object.fromEntries(
        result.rows.flatMap((row) => {
            if (typeof row.item_id !== "string") return [];
            const derived = deriveEffectivePrice(pointsById[row.item_id] ?? [], undefined, Date.now());
            const effectivePrice = derived.effectivePrice;
            const latestPrice = Number(row.latest_price);
            const latestPriceMin = Number(row.latest_price_min);
            const latestPointTimestamp = Number(row.latest_point_timestamp);
            const lastCheckedAt = Number(row.last_checked_at);
            if (
                (effectivePrice === null && !derived.reasons.includes("no-offers")) ||
                (effectivePrice !== null && !Number.isFinite(effectivePrice)) ||
                row.latest_price === null || row.latest_price_min === null ||
                row.latest_point_timestamp === null || row.last_checked_at === null ||
                latestPrice < 0 || latestPriceMin < 0 || latestPointTimestamp <= 0 ||
                !Number.isFinite(latestPrice) ||
                !Number.isFinite(latestPriceMin) ||
                !Number.isFinite(latestPointTimestamp) ||
                !Number.isFinite(lastCheckedAt) ||
                (row.latest_offer_count !== null && (!Number.isInteger(Number(row.latest_offer_count)) || Number(row.latest_offer_count) < 0))
            ) {
                return [];
            }
            return [[row.item_id, {
                itemId: row.item_id,
                effectivePrice,
                latestPrice,
                latestPriceMin,
                latestOfferCount:
                    row.latest_offer_count === null
                        ? null
                        : Number(row.latest_offer_count),
                latestPointTimestamp,
                sampleCount: derived.sampleCount,
                totalOfferCount: derived.totalOfferCount,
                lastCheckedAt,
                stability: derived.stability,
                reasons: derived.reasons,
            } satisfies StoredCurrentPrice]];
        }),
    );
}
