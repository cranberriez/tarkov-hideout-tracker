import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { ItemSummary } from "@/types/items";

export interface ManualPriceOverride {
    buy?: number;
    sell?: number;
}

export type ManualPriceOverrides = Record<string, ManualPriceOverride>;

export type AcquisitionMethod = "flea" | "barter" | "craft" | "unavailable";

export interface AcquisitionPlan {
    itemId: string;
    quantity: number;
    isTool?: boolean;
    method: AcquisitionMethod;
    sourceId?: string;
    batches: number;
    totalCost: number | null;
    theoreticalCost: number | null;
    theoreticalMethod: AcquisitionMethod;
    durationSeconds: number;
    children: AcquisitionPlan[];
}

export interface RecipeEvaluation {
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
}
