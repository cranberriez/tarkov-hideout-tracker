import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { ItemSummary, TraderPurchaseOffer } from "@/types/items";

export interface ManualPriceOverride {
    buy?: number;
    sell?: number;
}

export type ManualPriceOverrides = Record<string, ManualPriceOverride>;

export type AcquisitionMethod = "flea" | "trader" | "barter" | "craft" | "unavailable";

export interface AcquisitionAlternative {
    method: Exclude<AcquisitionMethod, "unavailable">;
    sourceId?: string;
    traderOffer?: TraderPurchaseOffer;
    batches: number;
    totalCost: number;
    theoreticalCost: number;
    durationSeconds: number;
    children: AcquisitionPlan[];
}

export interface AcquisitionPlan {
    itemId: string;
    quantity: number;
    isTool?: boolean;
    method: AcquisitionMethod;
    sourceId?: string;
    traderOffer?: TraderPurchaseOffer;
    batches: number;
    totalCost: number | null;
    selectedRouteTheoreticalCost?: number;
    theoreticalCost: number | null;
    theoreticalMethod: AcquisitionMethod;
    directBuyCost: number | null;
    directBuyMethod: "flea" | "trader" | null;
    durationSeconds: number;
    children: AcquisitionPlan[];
    alternatives: AcquisitionAlternative[];
}

export interface RecipeEvaluation {
    /** The selected sale value uses an unstable flea estimate. */
    sellValueIsEstimate?: boolean;
    sellSourceLabel?: string;
    id: string;
    kind: "barter" | "craft";
    outputItemId: string;
    outputCount: number;
    requiredItems: AcquisitionPlan[];
    cost: number | null;
    theoreticalCost: number | null;
    sellValue: number | null;
    profit: number | null;
    inputSellValue: number | null;
    profitVsSellingInputs: number | null;
    durationSeconds: number;
    profitPerHour: number | null;
    directBuyCost: number | null;
    directBuyMethod: "flea" | "trader" | null;
    isPracticallyWorthwhile: boolean | null;
    barter?: BarterRecord;
    craft?: CraftRecord;
}

export interface PriceCalculationContext {
    itemsById: Readonly<Record<string, ItemSummary>>;
    bartersByItemId: Readonly<Record<string, BarterRecord[]>>;
    craftsByItemId: Readonly<Record<string, CraftRecord[]>>;
    overrides?: ManualPriceOverrides;
    maxDepth?: number;
    allowBarters?: boolean;
    allowCrafts?: boolean;
    allowTraderPurchases?: boolean;
    traderLoyaltyLevels?: Readonly<Record<string, number>>;
    completedQuests?: Readonly<Record<string, boolean>>;
}

export interface RecipeCalculatorInput {
    itemsById: Readonly<Record<string, ItemSummary>>;
    barters: readonly BarterRecord[];
    crafts: readonly CraftRecord[];
    overrides?: ManualPriceOverrides;
    maxDepth?: number;
    allowBarters?: boolean;
    allowCrafts?: boolean;
    allowTraderPurchases?: boolean;
    traderLoyaltyLevels?: Readonly<Record<string, number>>;
    completedQuests?: Readonly<Record<string, boolean>>;
}
