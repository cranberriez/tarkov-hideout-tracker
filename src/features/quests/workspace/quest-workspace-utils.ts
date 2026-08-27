import type { FullQuest } from "@/types";
import type {
    QuestObjectiveCategory,
    QuestWorkspaceStatus,
} from "@/lib/stores/useUserStore";
import { getQuestMapGroupsForQuest } from "../quest-map-groups";
import { isQuestTraderLoyaltyRequirement } from "@/lib/utils/quest-trader-gates";
import { isQuestDisabledByCompletedFailedRequirement } from "@/lib/utils/quest-failures";

export type { QuestObjectiveCategory, QuestWorkspaceStatus } from "@/lib/stores/useUserStore";

export interface QuestLockReason {
    kind: "quest" | "level" | "loyalty" | "prestige" | "faction" | "branch";
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

function compareValue(current: number, method: string, required: number) {
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

export function getQuestWorkspaceStatus(
    quest: FullQuest,
    profile: QuestWorkspaceProfile,
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
    for (const requirement of quest.traderRequirements.filter(isQuestTraderLoyaltyRequirement)) {
        const current = profile.traderLoyaltyLevels[requirement.trader.id] ?? 1;
        if (!compareValue(current, requirement.compareMethod, requirement.value)) {
            reasons.push({
                kind: "loyalty",
                label: `${requirement.trader.name} LL${requirement.value}`,
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

export interface QuestMarkerAssignment {
    color: string;
    label: string;
    x: number;
    y: number;
}

function getMarkerLabel(index: number) {
    if (index < 26) return String.fromCharCode(97 + index);
    if (index < 52) return String.fromCharCode(65 + index - 26);
    return `${String.fromCharCode(97 + ((index - 52) % 26))}${Math.floor((index - 52) / 26) + 1}`;
}

export function hashQuestId(value: string) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createQuestMarkerAssignments(quests: FullQuest[]) {
    const result = new Map<string, QuestMarkerAssignment>();
    quests.forEach((quest, index) => {
        const hash = hashQuestId(quest.id);
        result.set(quest.id, {
            color: `hsl(${(hash % 360 + index * 137.508) % 360} 72% 58%)`,
            label: getMarkerLabel(index),
            x: 9 + (hash % 83),
            y: 10 + ((hash >>> 9) % 79),
        });
    });
    return result;
}

export function getQuestObjectiveSummary(quest: FullQuest) {
    const descriptions = quest.objectives
        .filter((objective) => !objective.optional)
        .slice(0, 2)
        .map((objective) => objective.description);
    return descriptions.join(" · ") || "Review quest objectives";
}
