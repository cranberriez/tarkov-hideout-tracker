import type { CraftRecord } from "@/types/recipes";

export function normalizeCraftingSkillLevel(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(51, Math.max(0, Math.trunc(value))) : 0;
}

export function craftingTimeReduction(level: number): number {
    return Math.min(50, normalizeCraftingSkillLevel(level)) * 0.0075;
}

export function craftingDuration(craft: Pick<CraftRecord, "stationId" | "duration">, level = 0): number {
    // Stable Bitcoin Farm ID from the station catalog; production is exempt.
    if (craft.stationId === "5d494a445b56502f18c98a10") return craft.duration;
    return craft.duration * (1 - craftingTimeReduction(level));
}
