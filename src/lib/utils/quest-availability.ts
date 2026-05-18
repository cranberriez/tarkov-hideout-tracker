import type {
    FullQuest,
    Quest,
    QuestPrerequisite,
    QuestTraderRequirement,
    QuestPrestige,
    QuestFailCondition,
} from "@/types";
import {
    isQuestDisabledByCompletedFailedRequirement,
    statusIncludesComplete,
    statusIncludesFailed,
} from "./quest-failures";

export type QuestFactionFilter = "USEC" | "BEAR";

export interface QuestAvailabilityProfile {
    playerLevel: number;
    prestigeLevel: number;
    faction: QuestFactionFilter | null;
    traderLoyaltyLevels: Record<string, number>;
    completedQuests: Record<string, boolean>;
    failedQuests?: Record<string, boolean>;
}

export interface QuestAvailabilityQuest {
    id: string;
    factionName?: string | null;
    minPlayerLevel?: number | null;
    kappaRequired?: boolean | null;
    lightkeeperRequired?: boolean | null;
    hasItemHandIn?: boolean;
    taskRequirements: QuestPrerequisite[];
    failConditions?: QuestFailCondition[];
    trader: {
        id: string;
        name: string;
        normalizedName: string;
        imageLink?: string | null;
        image4xLink?: string | null;
    };
    traderRequirements: QuestTraderRequirement[];
    requiredPrestige?: QuestPrestige | null;
}

export function buildQuestAvailabilityMap<T extends QuestAvailabilityQuest>(quests: T[]): Map<string, T> {
    return new Map(quests.map((quest) => [quest.id, quest]));
}

type QuestAvailabilitySource = Pick<
    Quest,
    | "id"
    | "factionName"
    | "minPlayerLevel"
    | "kappaRequired"
    | "lightkeeperRequired"
    | "taskRequirements"
    | "failConditions"
    | "trader"
> &
    Partial<Pick<FullQuest, "traderRequirements" | "requiredPrestige">> & {
        objectives?: FullQuest["objectives"] | Quest["objectives"];
    };

export function toQuestAvailabilityQuest(quest: QuestAvailabilitySource): QuestAvailabilityQuest {
    return {
        id: quest.id,
        factionName: quest.factionName,
        minPlayerLevel: quest.minPlayerLevel,
        kappaRequired: quest.kappaRequired ?? false,
        lightkeeperRequired: quest.lightkeeperRequired ?? false,
        hasItemHandIn: quest.objectives?.some((objective) => objective.type === "giveItem") ?? false,
        taskRequirements: quest.taskRequirements,
        failConditions: "failConditions" in quest ? (quest.failConditions ?? []) : [],
        trader: quest.trader,
        traderRequirements: quest.traderRequirements ?? [],
        requiredPrestige: quest.requiredPrestige ?? null,
    };
}

export function matchesFactionVisibility(
    questFaction: string | null | undefined,
    selectedFaction: QuestFactionFilter | null,
) {
    if (selectedFaction === null) return true;
    if (selectedFaction === "USEC") return questFaction !== "BEAR";
    return questFaction !== "USEC";
}

function getRequiredLoyaltyForQuest(quest: QuestAvailabilityQuest, traderId: string) {
    return (quest.traderRequirements ?? []).reduce((highest, requirement) => {
        if (requirement.trader.id !== traderId) return highest;
        return Math.max(highest, requirement.value);
    }, 1);
}

function requirementAllowsActiveStatus(requirement: QuestPrerequisite) {
    return requirement.status.some((status) => status.trim().toLowerCase() === "active");
}

function isQuestRequirementSatisfied(
    requirement: QuestPrerequisite,
    profile: QuestAvailabilityProfile,
    questsById: ReadonlyMap<string, QuestAvailabilityQuest>,
    visiting: Set<string>,
): boolean {
    if (
        statusIncludesComplete(requirement.status) &&
        (profile.completedQuests[requirement.task.id] ||
            profile.failedQuests?.[requirement.task.id])
    ) {
        return true;
    }

    if (statusIncludesFailed(requirement.status) && profile.failedQuests?.[requirement.task.id]) {
        return true;
    }

    if (!requirementAllowsActiveStatus(requirement)) return false;

    if (
        profile.completedQuests[requirement.task.id] ||
        profile.failedQuests?.[requirement.task.id]
    ) {
        return true;
    }

    const prerequisiteQuest = questsById.get(requirement.task.id);
    if (!prerequisiteQuest) return false;

    return isQuestAvailableForProfile(prerequisiteQuest, profile, questsById, visiting);
}

export function isQuestAvailableForProfile(
    quest: QuestAvailabilityQuest,
    profile: QuestAvailabilityProfile,
    questsById: ReadonlyMap<string, QuestAvailabilityQuest>,
    visiting = new Set<string>(),
): boolean {
    if (profile.completedQuests[quest.id]) return false;
    if (profile.failedQuests?.[quest.id]) return false;
    if (isQuestDisabledByCompletedFailedRequirement(quest, profile.completedQuests)) return false;
    if (!matchesFactionVisibility(quest.factionName, profile.faction)) return false;
    if ((quest.minPlayerLevel ?? 0) > profile.playerLevel) return false;
    if ((quest.requiredPrestige?.prestigeLevel ?? 0) > profile.prestigeLevel) return false;

    const traderLoyalty = profile.traderLoyaltyLevels[quest.trader.id] ?? 1;
    if (getRequiredLoyaltyForQuest(quest, quest.trader.id) > traderLoyalty) return false;
    if (visiting.has(quest.id)) return false;

    visiting.add(quest.id);
    const prerequisitesSatisfied = quest.taskRequirements.every((requirement) =>
        isQuestRequirementSatisfied(requirement, profile, questsById, visiting),
    );
    visiting.delete(quest.id);

    return prerequisitesSatisfied;
}
