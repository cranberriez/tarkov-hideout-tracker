import type { FullQuest } from "@/types";
import type {
    QuestObjectiveCategory,
    QuestWorkspaceStatus,
} from "@/lib/stores/useUserStore";
import { getQuestMapGroupsForQuest } from "../quest-map-groups";
import {
    getQuestTraderGateType,
    questTraderRequirementMatchesProfile,
} from "@/lib/utils/quest-trader-gates";
import { isQuestDisabledByCompletedFailedRequirement } from "@/lib/utils/quest-failures";
import {
    compareTraderTierCompletionCount,
    countCompletedTraderTierQuests,
    getTraderTierCompletionGate,
} from "@/lib/utils/quest-trader-completion-gates";

export type { QuestObjectiveCategory, QuestWorkspaceStatus } from "@/lib/stores/useUserStore";

export interface QuestLockReason {
    kind: "quest" | "level" | "loyalty" | "reputation" | "task-count" | "prestige" | "faction" | "branch";
    label: string;
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
            status: "locked",
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
        reasons.push({ kind: "level", label: `Requires level ${quest.minPlayerLevel}` });
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
            });
        }
    }
    const missingPrerequisites = quest.taskRequirements.filter((requirement) => {
        const statuses = requirement.status.map((status) => status.trim().toLowerCase());
        const prerequisiteComplete = !!profile.completedQuests[requirement.task.id];
        const prerequisiteFailed = !!profile.failedQuests[requirement.task.id];
        if (statuses.includes("complete") && (prerequisiteComplete || prerequisiteFailed)) return false;
        if (statuses.includes("failed") && prerequisiteFailed) return false;
        return true;
    });
    if (missingPrerequisites.length > 0) {
        reasons.push({
            kind: "quest",
            label: missingPrerequisites.length === 1
                ? `Requires ${missingPrerequisites[0].task.name}`
                : `${missingPrerequisites.length} prerequisite quests`,
        });
    }

    if (reasons.length > 0) return { status: "locked", label: "Locked", reasons, terminal };
    return { status: "active", label: "Active", reasons, terminal };
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
