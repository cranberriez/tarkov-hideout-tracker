import type { PriceHistoryPoint } from "@/types/prices";
import type { DataResult } from "@/types/common";
import type { TarkovJsonGameMode } from "@/server/services/tarkovJson/client";
import { TARKOV_API_HEADERS } from "./tarkovApi";

const PRICE_HISTORY_REVALIDATE_SECONDS = 7200;

export const PRICE_HISTORY_CUTOFF_TIMESTAMP = Date.UTC(2025, 11, 1);

interface UpstreamPricePoint {
    price?: unknown;
    priceMin?: unknown;
    offerCount?: unknown;
    timestamp?: unknown;
}

export function normalizePriceHistory(data: unknown): PriceHistoryPoint[] {
    if (!Array.isArray(data)) return [];

    return data
        .filter(
            (point): point is UpstreamPricePoint =>
                typeof point === "object" && point !== null,
        )
        .map((point) => ({
            price: Number(point.price),
            priceMin: Number(point.priceMin),
            offerCount:
                point.offerCount === null || point.offerCount === undefined
                    ? null
                    : Number(point.offerCount),
            timestamp: Number(point.timestamp),
        }))
        .filter(
            (point) =>
                Number.isFinite(point.price) &&
                point.price >= 0 &&
                Number.isFinite(point.priceMin) &&
                point.priceMin >= 0 &&
                Number.isFinite(point.timestamp) &&
                point.timestamp >= PRICE_HISTORY_CUTOFF_TIMESTAMP &&
                (point.offerCount === null || Number.isFinite(point.offerCount)),
        )
        .sort((left, right) => left.timestamp - right.timestamp);
}

interface UpstreamPriceResponse {
    data?: unknown;
}

export async function getJsonPriceHistory(
    mode: TarkovJsonGameMode,
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
