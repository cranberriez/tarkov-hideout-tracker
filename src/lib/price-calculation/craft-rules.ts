import type { CraftRecord, ItemAmountRef } from "@/types/recipes";

export const BITCOIN_FARM_STATION_ID = "5d494a445b56502f18c98a10";
export const WATER_COLLECTOR_STATION_ID = "5d484fc8654e760065037abf";
export const PHYSICAL_BITCOIN_ITEM_ID = "59faff1d86f7746c51718c9c";
export const BOTTLE_OF_WATER_ITEM_ID = "5448fee04bdc2dbc018b4567";
export const PURIFIED_WATER_ITEM_ID = "5d1b33a686f7742523398398";
export const WATER_FILTER_ITEM_ID = "5d1b385e86f774252167b98a";

/** Passive production and resource refills are not ordinary acquisition crafts. */
export function isTrackedCraft(craft: CraftRecord): boolean {
    const isBitcoinProduction =
        craft.stationId === BITCOIN_FARM_STATION_ID &&
        craft.productItemId === PHYSICAL_BITCOIN_ITEM_ID;
    const isWaterBottleRefill =
        craft.stationId === WATER_COLLECTOR_STATION_ID &&
        craft.productItemId === BOTTLE_OF_WATER_ITEM_ID &&
        craft.requiredItems.some((requirement) => requirement.itemId === BOTTLE_OF_WATER_ITEM_ID);
    return !isBitcoinProduction && !isWaterBottleRefill;
}

export function normalizeHideoutManagementSkillLevel(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(51, Math.max(0, Math.trunc(value)))
        : 0;
}

export function hideoutManagementConsumptionReduction(level: number): number {
    return Math.min(50, normalizeHideoutManagementSkillLevel(level)) * 0.005;
}

/** Adjust consumable resources only; fuel handling belongs to its future cost model. */
export function craftRequiredItems(
    craft: Pick<CraftRecord, "stationId" | "productItemId" | "requiredItems">,
    hideoutManagementSkillLevel = 0,
): ItemAmountRef[] {
    if (
        craft.stationId !== WATER_COLLECTOR_STATION_ID ||
        craft.productItemId !== PURIFIED_WATER_ITEM_ID
    ) {
        return craft.requiredItems;
    }
    const multiplier = 1 - hideoutManagementConsumptionReduction(hideoutManagementSkillLevel);
    return craft.requiredItems.map((requirement) =>
        requirement.itemId === WATER_FILTER_ITEM_ID && !requirement.isTool
            ? { ...requirement, count: requirement.count * multiplier }
            : requirement,
    );
}
