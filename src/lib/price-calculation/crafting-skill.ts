import type { CraftRecord } from "@/types/recipes";
import { BITCOIN_FARM_STATION_ID } from "./craft-rules";

export function normalizeCraftingSkillLevel(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(51, Math.max(0, Math.trunc(value))) : 0;
}

export function craftingTimeReduction(level: number): number {
    return Math.min(50, normalizeCraftingSkillLevel(level)) * 0.0075;
}

export function craftingDuration(craft: Pick<CraftRecord, "stationId" | "duration">, level = 0): number {
    // Stable Bitcoin Farm ID from the station catalog; production is exempt.
    if (craft.stationId === BITCOIN_FARM_STATION_ID) return craft.duration;
    return craft.duration * (1 - craftingTimeReduction(level));
}
