import type { FullQuest } from "@/types/quests";
import type {
    QuestObjectiveCategory,
    QuestWorkspaceLockedFilterSettings,
    QuestWorkspaceStatus,
} from "@/lib/stores/useUserStore";
import { getQuestMapGroupsForQuest } from "../quest-map-groups";
import {
    getQuestTraderGateType,
    questTraderRequirementMatchesProfile,
} from "../../../lib/utils/quest-trader-gates";
import { isQuestDisabledByCompletedFailedRequirement } from "../../../lib/utils/quest-failures";
import {
    compareTraderTierCompletionCount,
    countCompletedTraderTierQuests,
    getTraderTierCompletionGate,
} from "../../../lib/utils/quest-trader-completion-gates";
import { QUEST_SERIES_MANIFEST } from "../../../lib/utils/quest-series";
import { isQuestAvailableForProfile } from "../../../lib/utils/quest-availability";

export type { QuestObjectiveCategory, QuestWorkspaceStatus } from "@/lib/stores/useUserStore";

export interface QuestLockReason {
    kind: "quest" | "level" | "loyalty" | "reputation" | "task-count" | "prestige" | "faction" | "branch";
    label: string;
    currentValue?: number;
    requiredValue?: number;
    groupKey?: string;
}

export interface QuestWorkspaceStatusInfo {
    status: QuestWorkspaceStatus;
    label: string;
    reasons: QuestLockReason[];
    terminal: "completed" | "failed" | null;
}

export interface QuestWorkspaceProfile {
    playerLevel: number;
    prestigeLevel: number;
    faction: "USEC" | "BEAR" | null;
    traderLoyaltyLevels: Record<string, number>;
    fenceReputation: number;
    completedQuests: Record<string, boolean>;
    failedQuests: Record<string, boolean>;
}

export const STATUS_OPTIONS: Array<{ id: QuestWorkspaceStatus; label: string; description: string }> = [
    { id: "active", label: "Active", description: "Available and incomplete quests" },
    { id: "completed", label: "Completed", description: "Quests marked complete" },
    { id: "failed", label: "Failed", description: "Resolved quests whose failure condition was met" },
    { id: "locked", label: "Locked", description: "Quests with unmet progression gates" },
];

export const OBJECTIVE_CATEGORY_LABELS: Record<QuestObjectiveCategory, string> = {
    "hand-in": "Hand in items",
    find: "Find items",
    plant: "Plant / stash",
    eliminate: "Eliminate",
    extract: "Extract",
    location: "Locate / visit",
    build: "Build / modify",
    use: "Use items",
    other: "Other",
};

export const OBJECTIVE_CATEGORY_SHORT_LABELS: Record<QuestObjectiveCategory, string> = {
    "hand-in": "Items",
    find: "Find",
    plant: "Plant",
    eliminate: "Kill",
    extract: "Extract",
    location: "Visit",
    build: "Build",
    use: "Use",
    other: "Other",
};

const OBJECTIVE_CATEGORY_ORDER = Object.keys(OBJECTIVE_CATEGORY_LABELS) as QuestObjectiveCategory[];

function isTaskRequirementMet(
    requirement: FullQuest["taskRequirements"][number],
    profile: QuestWorkspaceProfile,
    questsById: ReadonlyMap<string, FullQuest>,
) {
    const statuses = requirement.status.map((status) => status.trim().toLowerCase());
    const prerequisiteComplete = !!profile.completedQuests[requirement.task.id];
    const prerequisiteFailed = !!profile.failedQuests[requirement.task.id];
    if (statuses.includes("complete") && (prerequisiteComplete || prerequisiteFailed)) return true;
    if (statuses.includes("failed") && prerequisiteFailed) return true;
    if (statuses.includes("active")) {
        if (prerequisiteComplete || prerequisiteFailed) return true;
        const prerequisite = questsById.get(requirement.task.id);
        if (!prerequisite) return false;
        return isQuestAvailableForProfile(prerequisite, profile, questsById);
    }
    return false;
}

export interface EssentialQuestSeries {
    id: string;
    title: string;
    questIds: string[];
}

const CURATED_ESSENTIAL_QUEST_SERIES: EssentialQuestSeries[] = QUEST_SERIES_MANIFEST.series
    .filter((series) => series.essential)
    .map((series) => ({
        id: series.id,
        title: series.name,
        questIds: series.members
            .slice()
            .sort((left, right) => left.order - right.order)
            .map((member) => member.questId),
    }));

function getEssentialQuestSeriesTitle(rootQuestName: string) {
    return rootQuestName
        .replace(/\s*\[PVE ZONE\]\s*$/i, "")
        .replace(/\s+-\s+Part\s+\d+.*$/i, "")
        .trim();
}

/**
 * Derive visual series from direct prerequisite links between Essential quests.
 * Cross-trader and non-Essential links deliberately terminate a series.
 */
export function buildEssentialQuestSeries(
    essentialQuests: FullQuest[],
    curatedSeries: EssentialQuestSeries[] = CURATED_ESSENTIAL_QUEST_SERIES,
): EssentialQuestSeries[] {
    const questById = new Map(essentialQuests.map((quest) => [quest.id, quest]));
    const orderById = new Map(essentialQuests.map((quest, index) => [quest.id, index]));
    const claimedQuestIds = new Set<string>();
    const series: EssentialQuestSeries[] = [];

    for (const curated of curatedSeries) {
        const availableQuestIds = curated.questIds.filter((questId) => questById.has(questId));
        if (availableQuestIds.length < 2) continue;

        series.push({ ...curated, questIds: availableQuestIds });
        for (const questId of availableQuestIds) claimedQuestIds.add(questId);
    }

    const automaticQuests = essentialQuests.filter((quest) => !claimedQuestIds.has(quest.id));
    const automaticQuestById = new Map(automaticQuests.map((quest) => [quest.id, quest]));
    const neighborsById = new Map(automaticQuests.map((quest) => [quest.id, new Set<string>()]));

    for (const quest of automaticQuests) {
        for (const requirement of quest.taskRequirements) {
            const prerequisite = automaticQuestById.get(requirement.task.id);
            if (!prerequisite || prerequisite.trader.id !== quest.trader.id) continue;

            neighborsById.get(quest.id)?.add(prerequisite.id);
            neighborsById.get(prerequisite.id)?.add(quest.id);
        }
    }

    const visited = new Set<string>();

    for (const quest of automaticQuests) {
        if (visited.has(quest.id)) continue;

        const componentIds: string[] = [];
        const pending = [quest.id];
        visited.add(quest.id);

        while (pending.length > 0) {
            const questId = pending.pop();
            if (!questId) continue;
            componentIds.push(questId);

            for (const neighborId of neighborsById.get(questId) ?? []) {
                if (visited.has(neighborId)) continue;
                visited.add(neighborId);
                pending.push(neighborId);
            }
        }

        // A lone Essential quest is a category member, not a series.
        if (componentIds.length < 2) continue;

        componentIds.sort((left, right) =>
            (orderById.get(left) ?? Number.MAX_SAFE_INTEGER) -
            (orderById.get(right) ?? Number.MAX_SAFE_INTEGER),
        );
        const rootQuest = questById.get(componentIds[0])!;
        series.push({
            id: rootQuest.id,
            title: getEssentialQuestSeriesTitle(rootQuest.name),
            questIds: componentIds,
        });
    }

    return series.sort((left, right) => {
        const leftOrder = Math.min(...left.questIds.map((questId) => orderById.get(questId) ?? Number.MAX_SAFE_INTEGER));
        const rightOrder = Math.min(...right.questIds.map((questId) => orderById.get(questId) ?? Number.MAX_SAFE_INTEGER));
        return leftOrder - rightOrder;
    });
}

function getMissingPrerequisiteQuestIds(
    quest: FullQuest,
    profile: QuestWorkspaceProfile,
    questsById: ReadonlyMap<string, FullQuest>,
) {
    const missingIds = new Set<string>();
    const visiting = new Set<string>();

    const visit = (current: FullQuest) => {
        if (visiting.has(current.id)) return;
        visiting.add(current.id);

        for (const requirement of current.taskRequirements) {
            if (isTaskRequirementMet(requirement, profile, questsById)) continue;
            missingIds.add(requirement.task.id);
            const prerequisite = questsById.get(requirement.task.id);
            if (prerequisite) visit(prerequisite);
        }

        visiting.delete(current.id);
    };

    visit(quest);
    missingIds.delete(quest.id);
    return missingIds;
}

export function getQuestWorkspaceStatus(
    quest: FullQuest,
    profile: QuestWorkspaceProfile,
    questsById: ReadonlyMap<string, FullQuest>,
): QuestWorkspaceStatusInfo {
    const terminal = profile.completedQuests[quest.id]
        ? "completed"
        : profile.failedQuests[quest.id]
          ? "failed"
          : null;
    const reasons: QuestLockReason[] = [];

    if (terminal === "completed") {
        return { status: "completed", label: "Completed", reasons, terminal };
    }
    if (terminal === "failed") {
        return {
            status: "failed",
            label: "Failed",
            reasons: [{ kind: "branch", label: "Quest marked failed" }],
            terminal,
        };
    }

    if (isQuestDisabledByCompletedFailedRequirement(quest, profile.completedQuests)) {
        reasons.push({ kind: "branch", label: "Unavailable quest branch" });
    }
    if (
        profile.faction &&
        (quest.factionName === "USEC" || quest.factionName === "BEAR") &&
        quest.factionName !== profile.faction
    ) {
        reasons.push({ kind: "faction", label: `Requires ${quest.factionName}` });
    }
    if ((quest.minPlayerLevel ?? 0) > profile.playerLevel) {
        reasons.push({
            kind: "level",
            label: `Requires level ${quest.minPlayerLevel}`,
            currentValue: profile.playerLevel,
            requiredValue: quest.minPlayerLevel ?? 0,
        });
    }
    if ((quest.requiredPrestige?.prestigeLevel ?? 0) > profile.prestigeLevel) {
        reasons.push({ kind: "prestige", label: `Requires prestige ${quest.requiredPrestige?.prestigeLevel}` });
    }
    for (const requirement of quest.traderRequirements) {
        if (questTraderRequirementMatchesProfile(requirement, profile)) continue;

        const gateType = getQuestTraderGateType(requirement);
        reasons.push({
            kind: gateType === "reputation" ? "reputation" : "loyalty",
            label: gateType === "reputation"
                ? `${requirement.trader.name} Rep ${requirement.compareMethod} ${requirement.value}`
                : `${requirement.trader.name} LL${requirement.value}`,
            ...(gateType === "level" ? {
                currentValue: profile.traderLoyaltyLevels[requirement.trader.id] ?? 1,
                requiredValue: requirement.value,
            } : {}),
        });
    }
    for (const requirement of quest.otherRequirements) {
        const gate = getTraderTierCompletionGate(requirement);
        if (!gate) continue;
        const completedCount = countCompletedTraderTierQuests(
            questsById.values(),
            profile.completedQuests,
            gate,
        );
        if (!compareTraderTierCompletionCount(completedCount, gate)) {
            reasons.push({
                kind: "task-count",
                label: `Complete ${gate.requiredCount} ${gate.trader} LL${gate.tier} tasks (${completedCount}/${gate.requiredCount})`,
                currentValue: completedCount,
                requiredValue: gate.requiredCount,
                groupKey: gate.variableId,
            });
        }
    }
    const missingPrerequisiteIds = getMissingPrerequisiteQuestIds(quest, profile, questsById);
    if (missingPrerequisiteIds.size > 0) {
        const [firstMissingId] = missingPrerequisiteIds;
        const firstMissingName = questsById.get(firstMissingId)?.name ??
            quest.taskRequirements.find((requirement) => requirement.task.id === firstMissingId)?.task.name ??
            "previous quest";
        reasons.push({
            kind: "quest",
            label: missingPrerequisiteIds.size === 1
                ? `Requires ${firstMissingName}`
                : `${missingPrerequisiteIds.size} prerequisite quests remaining`,
            currentValue: 0,
            requiredValue: missingPrerequisiteIds.size,
        });
    }

    if (reasons.length > 0) return { status: "locked", label: "Locked", reasons, terminal };
    return { status: "active", label: "Active", reasons, terminal };
}

export function buildNextTaskCountGateByGroup(
    statuses: Iterable<QuestWorkspaceStatusInfo>,
) {
    const nextGateByGroup = new Map<string, number>();

    for (const status of statuses) {
        if (status.status !== "locked") continue;
        for (const reason of status.reasons) {
            if (
                reason.kind !== "task-count" ||
                !reason.groupKey ||
                reason.requiredValue === undefined
            ) continue;

            const current = nextGateByGroup.get(reason.groupKey);
            if (current === undefined || reason.requiredValue < current) {
                nextGateByGroup.set(reason.groupKey, reason.requiredValue);
            }
        }
    }

    return nextGateByGroup;
}

function getMissingCount(reason: QuestLockReason) {
    if (reason.currentValue === undefined || reason.requiredValue === undefined) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, reason.requiredValue - reason.currentValue);
}

export function questMatchesLockedFilters(
    status: QuestWorkspaceStatusInfo,
    filters: QuestWorkspaceLockedFilterSettings,
    nextTaskCountGateByGroup: ReadonlyMap<string, number>,
) {
    if (status.status !== "locked") return true;
    if (filters.showAll) return true;
    const hasTaskCountGate = status.reasons.some((reason) => reason.kind === "task-count");

    return status.reasons.every((reason) => {
        if (reason.kind === "level") {
            return filters.showPlayerLevel && (
                !filters.playerLevelUpcomingOnly ||
                getMissingCount(reason) <= filters.playerLevelLookahead
            );
        }
        if (reason.kind === "task-count") {
            return filters.showTaskCount && (
                !filters.taskCountUpcomingOnly ||
                (reason.groupKey !== undefined &&
                    reason.requiredValue === nextTaskCountGateByGroup.get(reason.groupKey))
            );
        }
        if (reason.kind === "quest") {
            return filters.showPrerequisite && (
                !filters.prerequisiteUpcomingOnly ||
                getMissingCount(reason) <= filters.prerequisiteLookahead
            );
        }
        if (reason.kind === "faction") return filters.showFaction;
        // A task-count milestone is not upcoming until the trader LL that owns
        // that milestone has been reached. Loyalty-only locks retain their
        // existing visibility behavior.
        if (reason.kind === "loyalty" && hasTaskCountGate) return false;
        return true;
    });
}

export function isUpcomingLockedQuest(
    status: QuestWorkspaceStatusInfo,
    filters: QuestWorkspaceLockedFilterSettings,
    nextTaskCountGateByGroup: ReadonlyMap<string, number>,
) {
    if (filters.showAll) return false;
    if (!questMatchesLockedFilters(status, filters, nextTaskCountGateByGroup)) return false;

    const progressionReasons = status.reasons.filter((reason) =>
        reason.kind === "level" || reason.kind === "task-count" || reason.kind === "quest",
    );
    if (progressionReasons.length === 0) return false;

    return progressionReasons.every((reason) => {
        if (reason.kind === "level") return filters.playerLevelUpcomingOnly;
        if (reason.kind === "task-count") return filters.taskCountUpcomingOnly;
        return filters.prerequisiteUpcomingOnly;
    });
}

export function getObjectiveCategory(type: string): QuestObjectiveCategory {
    switch (type) {
        case "giveItem": return "hand-in";
        case "findItem":
        case "findQuestItem":
        case "pickupQuestItem": return "find";
        case "plantItem": return "plant";
        case "shoot": return "eliminate";
        case "extract": return "extract";
        case "visit":
        case "mark":
        case "locate": return "location";
        case "buildItem": return "build";
        case "useItem": return "use";
        default: return "other";
    }
}

export function getQuestObjectiveCategories(quest: FullQuest) {
    return new Set(quest.objectives.map((objective) => getObjectiveCategory(objective.type)));
}

export function getAvailableObjectiveCategories(quests: FullQuest[]) {
    const present = new Set<QuestObjectiveCategory>();
    quests.forEach((quest) => getQuestObjectiveCategories(quest).forEach((category) => present.add(category)));
    return OBJECTIVE_CATEGORY_ORDER.filter((category) => present.has(category));
}

export function getQuestMapKeys(quest: FullQuest) {
    return new Set(getQuestMapGroupsForQuest(quest).map((group) => group.key));
}

export function getQuestObjectiveSummary(quest: FullQuest) {
    const descriptions = quest.objectives
        .filter((objective) => !objective.optional)
        .slice(0, 2)
        .map((objective) => objective.description);
    return descriptions.join(" · ") || "Review quest objectives";
}
