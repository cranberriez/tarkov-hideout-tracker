import type { MarketPrice } from "@/types";

export function getFleaPrice(marketPrice: MarketPrice | null | undefined): number | null {
    return marketPrice?.avg24hPrice ?? marketPrice?.lastLowPrice ?? marketPrice?.price ?? null;
}

export function hasFleaMarketData(marketPrice: MarketPrice | null | undefined): boolean {
    if (!marketPrice) return false;
    return (
        marketPrice.avg24hPrice != null ||
        marketPrice.high24hPrice != null ||
        marketPrice.low24hPrice != null ||
        marketPrice.lastLowPrice != null ||
        marketPrice.changeLast48hPercent != null
    );
}

export function formatRoubles(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return "-";
    return `${new Intl.NumberFormat("en-US").format(value)} ₽`;
}

export function formatCompactRoubles(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return "-";
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`;
    }
    return new Intl.NumberFormat("en-US").format(value);
}
