import type { CurrentPrice } from "@/types/prices";

export function getFleaPrice(marketPrice: CurrentPrice | null | undefined): number | null {
    if (marketPrice?.fleaStability === "unavailable") return null;
    return getFleaPriceEstimate(marketPrice);
}

export function getFleaPriceEstimate(marketPrice: CurrentPrice | null | undefined): number | null {
    const assessed = marketPrice?.fleaStability && marketPrice.fleaStability !== "reference";
    const value = assessed ? marketPrice.price : marketPrice?.price ?? marketPrice?.avg24hPrice ?? marketPrice?.lastLowPrice;
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function fleaPriceStatusLabel(marketPrice: CurrentPrice | null | undefined): string | null {
    if (marketPrice?.fleaStability === "unavailable") return "Flea unavailable";
    if (marketPrice?.fleaStability === "unstable") return "Value unstable";
    return null;
}

export function hasFleaMarketData(marketPrice: CurrentPrice | null | undefined): boolean {
    if (!marketPrice) return false;
    return (
        marketPrice.fleaStability != null && marketPrice.fleaStability !== "reference" ||
        marketPrice.price != null ||
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

/**
 * Presentation state for a current flea price. Purchase cost, gross/net sale and
 * profit keep their own calculations; this only covers the shared loading,
 * unavailable and estimate states used by item references.
 */
export type FleaPriceState =
    | { kind: "loading" }
    | { kind: "failed" }
    | { kind: "missing" }
    | { kind: "unavailable"; label: string }
    | { kind: "no-flea" }
    | { kind: "price"; unitPrice: number; unstable: boolean };

export function describeFleaPrice(item: {
    marketPrice?: CurrentPrice | null;
    priceLoadState?: "pending" | "error" | "ready";
}): FleaPriceState {
    const marketPrice = item.marketPrice;
    if (!marketPrice) {
        if (item.priceLoadState === "pending") return { kind: "loading" };
        if (item.priceLoadState === "error") return { kind: "failed" };
        return { kind: "missing" };
    }
    if (marketPrice.fleaStability === "unavailable") {
        return { kind: "unavailable", label: fleaPriceStatusLabel(marketPrice) ?? "Flea unavailable" };
    }
    if (!hasFleaMarketData(marketPrice)) return { kind: "no-flea" };
    const unitPrice = getFleaPrice(marketPrice);
    return unitPrice == null
        ? { kind: "missing" }
        : { kind: "price", unitPrice, unstable: marketPrice.fleaStability === "unstable" };
}

/** Label for a price state; `count` multiplies the unit price for totals. */
export function formatFleaPriceState(
    state: FleaPriceState,
    { count = 1, compact = false }: { count?: number; compact?: boolean } = {},
): string {
    switch (state.kind) {
        case "loading":
            return "Loading…";
        case "failed":
            return "Price failed";
        case "missing":
            return "No data";
        case "unavailable":
            return state.label;
        case "no-flea":
            return "No flea";
        case "price": {
            const total = state.unitPrice * count;
            return compact ? `${formatCompactRoubles(total)} ₽` : formatRoubles(total);
        }
    }
}
