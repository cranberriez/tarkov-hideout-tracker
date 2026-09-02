import type { GlobalItem } from "@/types";
import type { ManualPriceOverrides } from "./types";

function validPrice(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : null;
}

export function getItemBuyPrice(
    item: GlobalItem | undefined,
    overrides: ManualPriceOverrides = {},
): number | null {
    if (!item) return null;
    const manual = validPrice(overrides[item.id]?.buy);
    if (manual !== null) return manual;
    if (item.normalizedName === "roubles") return 1;
    return validPrice(item.marketPrice?.avg24hPrice);
}

export function getItemSellPrice(
    item: GlobalItem | undefined,
    overrides: ManualPriceOverrides = {},
): number | null {
    if (!item) return null;
    const manual = validPrice(overrides[item.id]?.sell);
    if (manual !== null) return manual;
    if (item.normalizedName === "roubles") return 1;

    const candidates = [
        validPrice(item.marketPrice?.avg24hPrice),
        ...(item.marketPrice?.sellFor ?? []).map((offer) => validPrice(offer.priceRUB)),
    ].filter((price): price is number => price !== null);
    return candidates.length > 0 ? Math.max(...candidates) : null;
}

export function practicalSavingsThreshold(directBuyCost: number) {
    return Math.min(directBuyCost * 0.05, 5_000);
}
