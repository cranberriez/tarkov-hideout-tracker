import type { QuestTraderRequirement } from "@/types";

export type QuestTraderGateType = "level" | "reputation" | "unknown";

export interface DerivedQuestTraderGate {
    requirement: QuestTraderRequirement;
    type: QuestTraderGateType;
}

function normalizedRequirementType(requirement: QuestTraderRequirement) {
    return requirement.requirementType.trim().toLowerCase();
}

/**
 * Classify a trader requirement without rewriting its upstream fields.
 *
 * The JSON provider calls loyalty gates `level`; older GraphQL payloads and
 * existing saved/test fixtures use `loyaltyLevel`. Unknown kinds remain
 * unknown so they cannot accidentally be treated as a loyalty or reputation
 * gate.
 */
export function getQuestTraderGateType(
    requirement: QuestTraderRequirement,
): QuestTraderGateType {
    const type = normalizedRequirementType(requirement);
    if (type === "level" || type === "loyaltylevel") return "level";
    if (type === "reputation") return "reputation";
    return "unknown";
}

export function deriveQuestTraderGate(
    requirement: QuestTraderRequirement,
): DerivedQuestTraderGate {
    return {
        requirement,
        type: getQuestTraderGateType(requirement),
    };
}

export function isQuestTraderLoyaltyRequirement(requirement: QuestTraderRequirement) {
    return getQuestTraderGateType(requirement) === "level";
}

/**
 * Format a gate for quest metadata chips and sync rows. Unknown requirement
 * kinds intentionally use their raw type rather than an LL/Rep label.
 */
export function formatQuestTraderGate(requirement: QuestTraderRequirement) {
    const traderName = requirement.trader.name;
    const type = getQuestTraderGateType(requirement);

    if (type === "level") return `${traderName} LL${requirement.value}`;
    if (type === "reputation") {
        return `${traderName} Rep ${requirement.compareMethod} ${requirement.value}`;
    }

    const rawType = requirement.requirementType.trim() || "Requirement";
    return `${traderName} ${rawType} ${requirement.compareMethod} ${requirement.value}`;
}
