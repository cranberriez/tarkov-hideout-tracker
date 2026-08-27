import type { QuestOtherRequirement } from "@/types";
import { getQuestIssuingTraderLoyaltyLevel } from "./quest-trader-gates";

export type TraderTier = 1 | 2 | 3 | 4;

export interface TraderTierCompletionCounter {
    trader: string;
    tier: TraderTier;
}

export interface TraderTierCompletionGate extends TraderTierCompletionCounter {
    variableId: string;
    compareMethod: string;
    requiredCount: number;
}

/**
 * Known Tarkov global variables that count completed quests for one trader LL.
 * Keep this keyed by the upstream variable ID from global-variable-meanings.json.
 */
export const TRADER_TIER_COMPLETION_COUNTERS: Readonly<
    Record<string, TraderTierCompletionCounter>
> = {
    "6a20540cf1b67a977cc5a088": { trader: "Prapor", tier: 1 },
    "6a2688488bba18e0b0187a04": { trader: "Prapor", tier: 2 },
    "6a32651a811905ed0cac0973": { trader: "Prapor", tier: 3 },
    "6a326525789ae12ecb0b2807": { trader: "Prapor", tier: 4 },
    "6a4e4ab3ecd1145894d00990": { trader: "Therapist", tier: 1 },
    "6a4e4aed3ded7a18126603f6": { trader: "Therapist", tier: 2 },
    "6a4e4b28629dc64c4001967c": { trader: "Therapist", tier: 3 },
    "6a56925b1c30ba5a77c7c518": { trader: "Therapist", tier: 4 },
    "6a59f3ba06c8949abad30871": { trader: "Skier", tier: 1 },
    "6a5a111de1f417ac80a163e5": { trader: "Skier", tier: 2 },
    "6a5a115181116e807b55f258": { trader: "Skier", tier: 3 },
    "6a5a1192efde11cc7105b18f": { trader: "Skier", tier: 4 },
    "6a5ba40fe5c4eaef5610f232": { trader: "Peacekeeper", tier: 1 },
    "6a5ba450a7851e16ce0bde44": { trader: "Peacekeeper", tier: 2 },
    "6a5ba48b8cfd0bddb3d4d2e1": { trader: "Peacekeeper", tier: 3 },
    "6a5ba4c57cbb93b629051591": { trader: "Peacekeeper", tier: 4 },
    "6a3171c927ca9591bf4db1c4": { trader: "Mechanic", tier: 1 },
    "6a3c0fefbea2d2ad581c090b": { trader: "Mechanic", tier: 2 },
    "6a3cf95c6b35530c4a4f532e": { trader: "Mechanic", tier: 3 },
    "6a3d1c0990e9ffe15463e961": { trader: "Mechanic", tier: 4 },
    "6a43a01ccc83aceedd35f09c": { trader: "Jaeger", tier: 1 },
    "6a43a095bfef0cd74c298963": { trader: "Jaeger", tier: 2 },
    "6a43a13633c97d216dfc85de": { trader: "Jaeger", tier: 3 },
    "6a43a16dde81644a7951f31b": { trader: "Jaeger", tier: 4 },
    "6a4b339f18db62e03b4f7ded": { trader: "Ragman", tier: 1 },
    "6a4b4e6a30dac4b01af220aa": { trader: "Ragman", tier: 2 },
    "6a4b9c9a60b56d421cceea18": { trader: "Ragman", tier: 3 },
};

export interface TraderTierQuest {
    id: string;
    trader: { id: string; name: string; normalizedName: string };
    traderRequirements: Parameters<typeof getQuestIssuingTraderLoyaltyLevel>[0]["traderRequirements"];
}

function normalizeTraderName(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getRequirementVariableId(requirement: QuestOtherRequirement) {
    if (typeof requirement.variableId === "string") return requirement.variableId;
    return typeof requirement.id === "string" ? requirement.id : null;
}

export function getTraderTierCompletionGate(
    requirement: QuestOtherRequirement,
): TraderTierCompletionGate | null {
    const type = (requirement.requirementType || requirement.type).trim().toLowerCase();
    if (type !== "globalvariable") return null;

    const variableId = getRequirementVariableId(requirement);
    const counter = variableId ? TRADER_TIER_COMPLETION_COUNTERS[variableId] : undefined;
    const requiredCount = Number(requirement.value);
    if (!variableId || !counter || !Number.isFinite(requiredCount)) return null;

    return {
        variableId,
        trader: counter.trader,
        tier: counter.tier,
        compareMethod: requirement.compareMethod?.trim() || ">=",
        requiredCount,
    };
}

export function compareTraderTierCompletionCount(
    completedCount: number,
    gate: Pick<TraderTierCompletionGate, "compareMethod" | "requiredCount">,
) {
    switch (gate.compareMethod) {
        case ">": return completedCount > gate.requiredCount;
        case "<": return completedCount < gate.requiredCount;
        case "<=": return completedCount <= gate.requiredCount;
        case "=":
        case "==":
        case "===": return completedCount === gate.requiredCount;
        case "!=":
        case "!==": return completedCount !== gate.requiredCount;
        default: return completedCount >= gate.requiredCount;
    }
}

export function countCompletedTraderTierQuests(
    quests: Iterable<TraderTierQuest>,
    completedQuests: Readonly<Record<string, boolean>>,
    gate: Pick<TraderTierCompletionGate, "trader" | "tier">,
) {
    const expectedTrader = normalizeTraderName(gate.trader);
    let count = 0;

    for (const quest of quests) {
        if (!completedQuests[quest.id]) continue;
        const actualTrader = normalizeTraderName(quest.trader.normalizedName || quest.trader.name);
        if (actualTrader !== expectedTrader) continue;
        if (getQuestIssuingTraderLoyaltyLevel(quest) === gate.tier) count += 1;
    }

    return count;
}

export function formatTraderTierCompletionGate(gate: TraderTierCompletionGate) {
    return `${gate.trader} LL${gate.tier} tasks ${gate.compareMethod} ${gate.requiredCount}`;
}
