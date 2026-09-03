import type { ItemSummary } from "@/types/items";
import type { VendorPrice } from "@/types/prices";
import type { ManualPriceOverrides } from "./types";

function validPrice(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : null;
}

export function getItemBuyPrice(
    item: ItemSummary | undefined,
    overrides: ManualPriceOverrides = {},
): number | null {
    if (!item) return null;
    const manual = validPrice(overrides[item.id]?.buy);
    if (manual !== null) return manual;
    if (item.normalizedName === "roubles") return 1;
    return validPrice(item.marketPrice?.avg24hPrice);
}

export function getItemSellPrice(
    item: ItemSummary | undefined,
    overrides: ManualPriceOverrides = {},
): number | null {
    return getItemSellComparison(item, overrides).selectedPrice;
}

export interface ItemSellComparison {
    fleaPrice: number | null;
    bestTraderOffer: VendorPrice | null;
    manualPrice: number | null;
    selectedPrice: number | null;
    selectedSource: "manual" | "flea" | "trader" | "unavailable";
    pricesAreClose: boolean;
}

export function getItemSellComparison(
    item: ItemSummary | undefined,
    overrides: ManualPriceOverrides = {},
): ItemSellComparison {
    const unavailable: ItemSellComparison = {
        fleaPrice: null,
        bestTraderOffer: null,
        manualPrice: null,
        selectedPrice: null,
        selectedSource: "unavailable",
        pricesAreClose: false,
    };
    if (!item) return unavailable;
    const manual = validPrice(overrides[item.id]?.sell);
    const fleaPrice = item.normalizedName === "roubles"
        ? 1
        : validPrice(item.marketPrice?.avg24hPrice);
    const bestTraderOffer = [...(item.marketPrice?.sellFor ?? [])]
        .filter((offer) => validPrice(offer.priceRUB) !== null)
        .sort((left, right) => right.priceRUB - left.priceRUB)[0] ?? null;
    const traderPrice = bestTraderOffer ? validPrice(bestTraderOffer.priceRUB) : null;
    const pricesAreClose = fleaPrice !== null && traderPrice !== null
        ? Math.abs(fleaPrice - traderPrice) <= Math.min(Math.max(fleaPrice, traderPrice) * 0.05, 5_000)
        : false;

    if (manual !== null) {
        return { fleaPrice, bestTraderOffer, manualPrice: manual, selectedPrice: manual, selectedSource: "manual", pricesAreClose };
    }
    if (fleaPrice === null && traderPrice === null) return unavailable;
    if (traderPrice !== null && (fleaPrice === null || traderPrice > fleaPrice)) {
        return { fleaPrice, bestTraderOffer, manualPrice: null, selectedPrice: traderPrice, selectedSource: "trader", pricesAreClose };
    }
    return { fleaPrice, bestTraderOffer, manualPrice: null, selectedPrice: fleaPrice, selectedSource: "flea", pricesAreClose };
}

export function practicalSavingsThreshold(directBuyCost: number) {
    return Math.min(directBuyCost * 0.05, 5_000);
}
