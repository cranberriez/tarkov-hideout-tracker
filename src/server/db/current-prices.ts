import type { Client } from "@libsql/client";
import type { TarkovDataMode } from "@/types/common";
import type { StoredCurrentPrice } from "@/types/prices";
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
                AND effective_price IS NOT NULL
                AND item_id IN (SELECT value FROM json_each(?))
        `,
        args: [mode, JSON.stringify([...new Set(itemIds)])],
    });
    return Object.fromEntries(
        result.rows.flatMap((row) => {
            if (typeof row.item_id !== "string") return [];
            const effectivePrice = Number(row.effective_price);
            const latestPrice = Number(row.latest_price);
            const latestPriceMin = Number(row.latest_price_min);
            const latestPointTimestamp = Number(row.latest_point_timestamp);
            const lastCheckedAt = Number(row.last_checked_at);
            if (
                !Number.isFinite(effectivePrice) ||
                !Number.isFinite(latestPrice) ||
                !Number.isFinite(latestPriceMin) ||
                !Number.isFinite(latestPointTimestamp) ||
                !Number.isFinite(lastCheckedAt)
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
                sampleCount: Number(row.sample_count),
                totalOfferCount: Number(row.total_offer_count),
                lastCheckedAt,
            } satisfies StoredCurrentPrice]];
        }),
    );
}
