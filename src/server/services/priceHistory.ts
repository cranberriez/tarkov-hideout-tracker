import type { PriceHistoryPoint } from "@/lib/utils/price-history";

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
