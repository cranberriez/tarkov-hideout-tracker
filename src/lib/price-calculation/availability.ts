import type { ItemSummary, TraderPurchaseOffer } from "@/types/items";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { LockReason, PriceCalculationContext } from "./types";

type AvailabilityContext = Pick<PriceCalculationContext, "stationLevels" | "traderLoyaltyLevels" | "completedQuests">;

export function getFleaLockReasons(item: ItemSummary | undefined, playerLevel?: number): LockReason[] {
    if (!item) return [{ kind: "unavailable", message: "Item data unavailable" }];
    if (item.normalizedName === "roubles") return [];
    const reasons: LockReason[] = [];
    if (item.onFleaMarket === false) return [{ kind: "flea", message: "Not on flea" }];
    const level = Math.max(15, item.minLevelForFlea ?? 15);
    if (playerLevel !== undefined && playerLevel < level) {
        reasons.push({ kind: "flea", message: `Flea unlocks at lvl ${level}` });
    }
    return reasons;
}

export function getTraderLockReasons(offer: Pick<TraderPurchaseOffer, "traderId" | "minTraderLevel" | "taskUnlockId">, context: AvailabilityContext): LockReason[] {
    const reasons: LockReason[] = [];
    if ((context.traderLoyaltyLevels?.[offer.traderId] ?? 1) < offer.minTraderLevel) {
        reasons.push({ kind: "vendor", message: `Trader is LL${context.traderLoyaltyLevels?.[offer.traderId] ?? 1}` });
    }
    if (offer.taskUnlockId && context.completedQuests?.[offer.taskUnlockId] !== true) {
        reasons.push({ kind: "quest", questId: offer.taskUnlockId, message: "Complete required quest" });
    }
    return reasons;
}

export function getRecipeLockReasons(recipe: BarterRecord | CraftRecord, context: AvailabilityContext): LockReason[] {
    if ("traderId" in recipe) return getTraderLockReasons(recipe, context);
    const reasons: LockReason[] = [];
    if (context.stationLevels !== undefined && (context.stationLevels[recipe.stationId] ?? 0) < recipe.level) {
        reasons.push({ kind: "station", message: `Station is lvl ${context.stationLevels[recipe.stationId] ?? 0}` });
    }
    if (recipe.taskUnlockId && context.completedQuests?.[recipe.taskUnlockId] !== true) {
        reasons.push({ kind: "quest", questId: recipe.taskUnlockId, message: "Complete required quest" });
    }
    return reasons;
}
