import type { FullQuest, QuestTraderRequirement } from "@/types/quests";
import { getQuestLoyaltyLevelOverride } from "./quest-trader-tab-overrides";

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

export type QuestTraderLoyaltyLevel = 1 | 2 | 3 | 4;

/**
 * Return the issuing trader loyalty level required by a quest. Quests without
 * an explicit own-trader level gate are LL1. Cross-trader gates do not change
 * the tier shown for the issuing trader.
 */
export function getQuestIssuingTraderLoyaltyLevel(
    quest: Pick<FullQuest, "trader" | "traderRequirements"> & { id?: string },
): QuestTraderLoyaltyLevel {
    const override = quest.id ? getQuestLoyaltyLevelOverride(quest.id) : null;
    if (override !== null) return override;

    const ownTraderLevels = quest.traderRequirements
        .filter(
            (requirement) =>
                requirement.trader.id === quest.trader.id &&
                isQuestTraderLoyaltyRequirement(requirement),
        )
        .map((requirement) => requirement.value)
        .filter((value) => Number.isFinite(value));

    const level = ownTraderLevels.length > 0 ? Math.max(...ownTraderLevels) : 1;
    return Math.min(4, Math.max(1, Math.round(level))) as QuestTraderLoyaltyLevel;
}

function compareTraderRequirement(current: number, method: string, required: number) {
    switch (method.trim()) {
        case ">": return current > required;
        case "<": return current < required;
        case "<=": return current <= required;
        case "=":
        case "==":
        case "===": return current === required;
        case "!=":
        case "!==": return current !== required;
        default: return current >= required;
    }
}

export interface QuestTraderRequirementProfile {
    traderLoyaltyLevels: Record<string, number>;
    fenceReputation: number;
}

export function questTraderRequirementMatchesProfile(
    requirement: QuestTraderRequirement,
    profile: QuestTraderRequirementProfile,
) {
    const type = getQuestTraderGateType(requirement);
    if (type === "level") {
        return compareTraderRequirement(
            profile.traderLoyaltyLevels[requirement.trader.id] ?? 1,
            requirement.compareMethod,
            requirement.value,
        );
    }

    const isFence =
        requirement.trader.normalizedName === "fence" ||
        requirement.trader.name.trim().toLowerCase() === "fence";
    if (type === "reputation" && isFence) {
        return compareTraderRequirement(
            profile.fenceReputation,
            requirement.compareMethod,
            requirement.value,
        );
    }

    return true;
}

export function questMatchesTraderRequirementProfile(
    quest: Pick<FullQuest, "traderRequirements">,
    profile: QuestTraderRequirementProfile,
) {
    return quest.traderRequirements.every((requirement) =>
        questTraderRequirementMatchesProfile(requirement, profile),
    );
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
