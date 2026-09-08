import type { ItemSummary } from "@/types/items";
import type { VendorPrice } from "@/types/prices";
import { getFleaLockReasons } from "./availability";
import type { PriceCalculationContext, ManualPriceOverrides } from "./types";
import { getFleaPrice } from "../utils/market-price";
import { calcTax, itemBasePrice, type TaxOptions } from "./calc-tax";

type SaleContext = TaxOptions & Pick<PriceCalculationContext, "playerLevel" | "useTraderSaleForLockedOutputs">;

function validPrice(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
        ? value
        : null;
}

export function getItemBuyPrice(
    item: ItemSummary | undefined,
    overrides: ManualPriceOverrides = {},
    context: Pick<PriceCalculationContext, "playerLevel" | "useTraderSaleForLockedOutputs"> = {},
): number | null {
    if (!item) return null;
    const manual = validPrice(overrides[item.id]?.buy);
    if (manual !== null) return manual;
    if (item.normalizedName === "roubles") return 1;
    return getFleaLockReasons(item, context.playerLevel).length ? null : getFleaPrice(item.marketPrice);
}

export function getItemSellPrice(
    item: ItemSummary | undefined,
    overrides: ManualPriceOverrides = {},
    context: SaleContext = {},
): number | null {
    return getItemSellComparison(item, overrides, context).selectedNetPrice;
}

export interface ItemSellComparison {
    isEstimate: boolean;
    fleaPrice: number | null;
    bestTraderOffer: VendorPrice | null;
    manualPrice: number | null;
    selectedPrice: number | null;
    selectedSource: "manual" | "flea" | "trader" | "unavailable";
    pricesAreClose: boolean;
    selectedNetPrice: number | null;
    netTotal: number | null;
    grossTotal: number | null;
    fee: number | null;
    fleaNetTotal: number | null;
    fleaFee: number | null;
    saleDestination: "flea" | "trader" | null;
}

export function getItemSellComparison(
    item: ItemSummary | undefined,
    overrides: ManualPriceOverrides = {},
    context: SaleContext = {},
    quantity = 1,
): ItemSellComparison {
    const unavailable: ItemSellComparison = {
        isEstimate: false,
        fleaPrice: null,
        bestTraderOffer: null,
        manualPrice: null,
        selectedPrice: null,
        selectedSource: "unavailable",
        pricesAreClose: false,
        selectedNetPrice: null, netTotal: null, grossTotal: null, fee: null,
        fleaNetTotal: null, fleaFee: null, saleDestination: null,
    };
    if (!item) return unavailable;
    const manual = validPrice(overrides[item.id]?.sell);
    const locked = item.normalizedName !== "roubles" && getFleaLockReasons(item, context.playerLevel).length > 0;
    const fleaPrice = locked ? null : item.normalizedName === "roubles"
        ? 1
        : getFleaPrice(item.marketPrice);
    const bestTraderOffer = [...(item.marketPrice?.sellFor ?? [])]
        .filter((offer) => validPrice(offer.priceRUB) !== null)
        .sort((left, right) => right.priceRUB - left.priceRUB)[0] ?? null;
    const traderPrice = bestTraderOffer ? validPrice(bestTraderOffer.priceRUB) : null;
    const base = itemBasePrice(item.marketPrice?.sellFor, context);
    const fleaFee = fleaPrice === null ? null : item.normalizedName === "roubles" ? 0 : base === null ? null : calcTax(base, fleaPrice, quantity, context);
    const fleaNetTotal = fleaPrice === null || fleaFee === null ? null : fleaPrice * quantity - fleaFee;
    const fleaNetUnit = fleaNetTotal === null || quantity <= 0 ? null : fleaNetTotal / quantity;
    const pricesAreClose = fleaNetUnit !== null && traderPrice !== null
        ? Math.abs(fleaNetUnit - traderPrice) <= Math.min(Math.max(fleaNetUnit, traderPrice) * 0.05, 5_000)
        : false;
    const common = { fleaPrice, bestTraderOffer, manualPrice: manual, pricesAreClose, fleaNetTotal, fleaFee };
    const resolved = (price: number, fee: number | null, source: "manual" | "flea" | "trader", destination: "flea" | "trader"): ItemSellComparison => ({
        ...common, selectedPrice: price, selectedSource: source,
        selectedNetPrice: fee === null || quantity <= 0 ? null : price - fee / quantity,
        grossTotal: price * quantity, netTotal: fee === null ? null : price * quantity - fee, fee,
        saleDestination: destination, isEstimate: source === "flea" && item.marketPrice?.fleaStability === "unstable",
    });
    if (manual !== null) {
        const destination = overrides[item.id]?.sellSource ?? (locked ? "trader" : "flea");
        return resolved(manual, destination === "trader" || manual === 0 ? 0 : base === null ? null : calcTax(base, manual, quantity, context), "manual", destination);
    }
    if (locked && context.useTraderSaleForLockedOutputs === false) return { ...unavailable, bestTraderOffer };
    if (fleaNetUnit === null && traderPrice === null) return { ...unavailable, ...common };
    if (traderPrice !== null && (fleaNetUnit === null || traderPrice >= fleaNetUnit)) {
        return resolved(traderPrice, 0, "trader", "trader");
    }
    return resolved(fleaPrice!, fleaFee, "flea", "flea");
}

export function practicalSavingsThreshold(directBuyCost: number) {
    return Math.min(directBuyCost * 0.05, 5_000);
}
