import type { QuestRef } from "../QuestCard";
import { isQuestAvailableForProfile, type QuestSyncProfile } from "../quest-sync";
import type { FullQuest } from "@/types";
import { buildTraderTree, type TraderTreeMeta } from "./quest-tree-builder";
import {
    partitionLinkedPrerequisites,
    shouldFoldLinkedPrerequisites,
    type LinkedPrerequisiteStatus,
} from "./quest-tree-prerequisites";

export interface QuestTreeData {
    questsByTraderId: Map<string, FullQuest[]>;
    allQuestsByTraderId: Map<string, FullQuest[]>;
    treeMetaByTraderId: Map<string, TraderTreeMeta>;
    visibleTraders: FullQuest["trader"][];
}

export interface LinkedPrerequisiteEntry {
    questRef: QuestRef;
    status: LinkedPrerequisiteStatus;
    folded: boolean;
}

export function groupQuestsByTraderId(quests: FullQuest[]): Map<string, FullQuest[]> {
    const map = new Map<string, FullQuest[]>();
    for (const quest of quests) {
        const arr = map.get(quest.trader.id) ?? [];
        arr.push(quest);
        map.set(quest.trader.id, arr);
    }
    return map;
}

export function buildQuestTreeData({
    filteredQuests,
    quests,
    traders,
}: {
    filteredQuests: FullQuest[];
    quests: FullQuest[];
    traders: FullQuest["trader"][];
}): QuestTreeData {
    const questsByTraderId = groupQuestsByTraderId(filteredQuests);
    const allQuestsByTraderId = groupQuestsByTraderId(quests);
    const treeMetaByTraderId = new Map<string, TraderTreeMeta>();
    const visibleTraders = traders.filter((trader) => {
        const traderQuests = questsByTraderId.get(trader.id) ?? [];
        if (traderQuests.length === 0) return false;

        treeMetaByTraderId.set(trader.id, buildTraderTree(traderQuests, filteredQuests));
        return true;
    });

    return {
        questsByTraderId,
        allQuestsByTraderId,
        treeMetaByTraderId,
        visibleTraders,
    };
}

export function getTraderCompletion(
    quests: FullQuest[],
    completedQuests: Record<string, boolean>,
): {
    total: number;
    completed: number;
    pct: number;
} {
    const total = quests.length;
    const completed = quests.filter((quest) => completedQuests[quest.id]).length;
    return {
        total,
        completed,
        pct: total > 0 ? (completed / total) * 100 : 0,
    };
}

export function toQuestRef(
    id: string,
    fallbackName: string,
    questsById: ReadonlyMap<string, FullQuest>,
): QuestRef {
    const quest = questsById.get(id);
    return {
        id,
        name: quest?.name ?? fallbackName,
        trader: quest
            ? {
                  imageLink: quest.trader.imageLink ?? null,
                  image4xLink: quest.trader.image4xLink ?? null,
                  name: quest.trader.name,
              }
            : { imageLink: null, image4xLink: null, name: "?" },
    };
}

export function getPrerequisiteType(statuses: string[]): QuestRef["prerequisiteType"] {
    const normalized = statuses.map((status) => status.toLowerCase());
    if (normalized.includes("complete") && normalized.includes("failed")) return "resolved";
    if (normalized.includes("failed")) return "failed";
    if (normalized.includes("active")) return "active";
    return "complete";
}

export function countAllDescendants(ids: string[], childrenOf: Map<string, string[]>): number {
    let total = ids.length;
    for (const id of ids) {
        const children = childrenOf.get(id) ?? [];
        if (children.length > 0) total += countAllDescendants(children, childrenOf);
    }
    return total;
}

export function collectLinearChainIds(
    startId: string,
    childrenOf: Map<string, string[]>,
): string[] {
    const ids: string[] = [];
    let currentId = startId;

    while (true) {
        const children = childrenOf.get(currentId) ?? [];
        if (children.length !== 1) break;

        const nextId = children[0];
        ids.push(nextId);
        currentId = nextId;
    }

    return ids;
}

export function getBranchCollapseKey(questId: string) {
    return `branch:${questId}`;
}

export function getLinearCollapseKey(questId: string) {
    return `linear:${questId}`;
}

export function getTraderCollapseKey(traderId: string) {
    return `trader:${traderId}`;
}

export function buildLinkedPrerequisiteEntries({
    quest,
    parentOf,
    questsById,
    completedQuests,
    ignoredQuests,
    syncProfile,
}: {
    quest: FullQuest;
    parentOf: Map<string, string | null>;
    questsById: ReadonlyMap<string, FullQuest>;
    completedQuests: Record<string, boolean>;
    ignoredQuests: Record<string, boolean>;
    syncProfile: QuestSyncProfile;
}): LinkedPrerequisiteEntry[] {
    const primaryParentId = parentOf.get(quest.id) ?? null;
    const linkedPrerequisites = quest.taskRequirements
        .filter((req) => req.task.id !== primaryParentId)
        .map((req) => {
            const questRef = toQuestRef(req.task.id, req.task.name, questsById);
            const linkedQuest = questsById.get(req.task.id);
            const status: LinkedPrerequisiteStatus = completedQuests[req.task.id]
                ? "completed"
                : linkedQuest && isQuestAvailableForProfile(linkedQuest, syncProfile, questsById)
                  ? "available"
                  : "locked";

            return { questRef, status };
        });

    const foldPrerequisites = shouldFoldLinkedPrerequisites({
        completed: !!completedQuests[quest.id],
        ignored: !!ignoredQuests[quest.id],
        prerequisiteIds: quest.taskRequirements.map((req) => req.task.id),
    });
    const partitionedPrerequisites = partitionLinkedPrerequisites({
        completed: !!completedQuests[quest.id],
        ignored: !!ignoredQuests[quest.id],
        linkedPrerequisites: linkedPrerequisites.map((item) => ({
            id: item.questRef.id,
            status: item.status,
        })),
    });

    return [
        ...partitionedPrerequisites.expanded.map((item) => ({
            questRef:
                linkedPrerequisites.find(
                    (linkedPrerequisite) => linkedPrerequisite.questRef.id === item.id,
                )?.questRef ?? toQuestRef(item.id, item.id, questsById),
            status: item.status,
            folded: false,
        })),
        ...partitionedPrerequisites.folded.map((item) => ({
            questRef:
                linkedPrerequisites.find(
                    (linkedPrerequisite) => linkedPrerequisite.questRef.id === item.id,
                )?.questRef ?? toQuestRef(item.id, item.id, questsById),
            status: item.status,
            folded: foldPrerequisites,
        })),
    ];
}
