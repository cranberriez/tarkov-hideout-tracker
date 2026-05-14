import type { FullQuest, FullQuestObjective, Quest, QuestObjectiveItemType, QuestPrerequisite } from "@/types";
import {
    buildQuestAvailabilityMap,
    isQuestAvailableForProfile,
    type QuestAvailabilityProfile,
    type QuestAvailabilityQuest,
} from "./quest-availability.ts";

type QuestWithGiveItemData = Pick<
    Quest,
    "id" | "name" | "normalizedName" | "wikiLink" | "minPlayerLevel" | "trader" | "taskRequirements" | "objectives"
>;

type FullQuestWithGiveItemData = Pick<
    FullQuest,
    "id" | "name" | "normalizedName" | "wikiLink" | "minPlayerLevel" | "trader" | "taskRequirements" | "objectives"
>;

type QuestItemSource = QuestWithGiveItemData | FullQuestWithGiveItemData;

export interface QuestItemLink {
    itemId: string;
    questId: string;
    questName: string;
    questNormalizedName: string;
    questWikiLink?: string | null;
    traderId: string;
    traderName: string;
    traderImageLink?: string | null;
    traderImage4xLink?: string | null;
    prerequisiteQuestIds: string[];
    prerequisiteDepth: number;
    minPlayerLevel?: number | null;
    requiredCount: number;
    requiredFirCount: number;
    totalObjectiveCount: number;
    isFirRequired: boolean;
}

export interface QuestItemIndexEntry {
    itemId: string;
    normalizedName: string;
    name: string;
    iconLink?: string;
    gridImageLink?: string;
    quests: QuestItemLink[];
}

export type DerivedQuestItemStatus = "available" | "future" | "completed" | "ignored";

export interface DerivedQuestItemQuest extends QuestItemLink {
    status: DerivedQuestItemStatus;
    isPinned: boolean;
    isActive: boolean;
}

export interface DerivedQuestItemState {
    itemId: string;
    normalizedName: string;
    name: string;
    iconLink?: string;
    gridImageLink?: string;
    activeQuestDepth: number | null;
    hasAvailableQuest: boolean;
    availableQuestCount: number;
    futureQuestCount: number;
    pinnedQuestCount: number;
    relatedQuestCount: number;
    requiredCount: number;
    requiredFirCount: number;
    pinnedRequiredCount: number;
    pinnedRequiredFirCount: number;
    relatedQuests: DerivedQuestItemQuest[];
}

export interface QuestItemDeriveOptions {
    completedQuests: Record<string, boolean>;
    ignoredQuests: Record<string, boolean>;
    pinnedQuests: Record<string, boolean>;
    playerLevel: number;
    prestigeLevel: number;
    faction: QuestAvailabilityProfile["faction"];
    traderLoyaltyLevels: Record<string, number>;
    quests: QuestAvailabilityQuest[];
}

function isGiveItemObjective(
    objective: QuestObjectiveItemType | FullQuestObjective,
): objective is QuestObjectiveItemType {
    return objective.type === "giveItem" && "items" in objective;
}

export function hasGiveItemObjectives(quest: FullQuest | Quest): boolean {
    return quest.objectives.some((objective) => isGiveItemObjective(objective));
}

export function hasFirGiveItemObjectives(quest: FullQuest | Quest): boolean {
    return quest.objectives.some(
        (objective) => isGiveItemObjective(objective) && objective.foundInRaid,
    );
}

function getQuestDepthMap<T extends { id: string; taskRequirements: QuestPrerequisite[] }>(
    quests: T[],
): Map<string, number> {
    const questMap = new Map(quests.map((quest) => [quest.id, quest]));
    const depthCache = new Map<string, number>();

    function getDepth(id: string, visiting: Set<string>): number {
        if (depthCache.has(id)) return depthCache.get(id)!;
        if (visiting.has(id)) return 0;

        const quest = questMap.get(id);
        if (!quest || quest.taskRequirements.length === 0) {
            depthCache.set(id, 0);
            return 0;
        }

        visiting.add(id);
        let maxPrereqDepth = -1;

        for (const req of quest.taskRequirements) {
            const depth = getDepth(req.task.id, visiting);
            if (depth > maxPrereqDepth) {
                maxPrereqDepth = depth;
            }
        }

        visiting.delete(id);

        const depth = maxPrereqDepth + 1;
        depthCache.set(id, depth);
        return depth;
    }

    for (const quest of quests) {
        getDepth(quest.id, new Set());
    }

    return depthCache;
}

export function buildQuestItemIndex(quests: QuestItemSource[]): QuestItemIndexEntry[] {
    const depthMap = getQuestDepthMap(quests);
    const itemsById = new Map<string, QuestItemIndexEntry>();

    for (const quest of quests) {
        const itemLinks = new Map<string, QuestItemLink>();

        for (const objective of quest.objectives) {
            if (!isGiveItemObjective(objective)) continue;

            for (const item of objective.items) {
                const existing = itemLinks.get(item.id);
                if (existing) {
                    existing.requiredCount += objective.count;
                    existing.totalObjectiveCount += objective.count;
                    if (objective.foundInRaid) {
                        existing.requiredFirCount += objective.count;
                        existing.isFirRequired = true;
                    }
                    continue;
                }

                itemLinks.set(item.id, {
                    itemId: item.id,
                    questId: quest.id,
                    questName: quest.name,
                    questNormalizedName: quest.normalizedName,
                    questWikiLink: quest.wikiLink,
                    traderId: quest.trader.id,
                    traderName: quest.trader.name,
                    traderImageLink: "imageLink" in quest.trader ? quest.trader.imageLink ?? null : null,
                    traderImage4xLink:
                        "image4xLink" in quest.trader ? quest.trader.image4xLink ?? null : null,
                    prerequisiteQuestIds: quest.taskRequirements.map((req) => req.task.id),
                    prerequisiteDepth: depthMap.get(quest.id) ?? 0,
                    minPlayerLevel: quest.minPlayerLevel ?? null,
                    requiredCount: objective.count,
                    requiredFirCount: objective.foundInRaid ? objective.count : 0,
                    totalObjectiveCount: objective.count,
                    isFirRequired: objective.foundInRaid,
                });
            }
        }

        for (const questLink of itemLinks.values()) {
            const existingEntry = itemsById.get(questLink.itemId);

            if (existingEntry) {
                existingEntry.quests.push({ ...questLink });
                continue;
            }

            const giveItemChoices = quest.objectives.reduce<Array<QuestObjectiveItemType["items"][number]>>(
                (acc, objective) => {
                    if (isGiveItemObjective(objective)) {
                        acc.push(...objective.items);
                    }
                    return acc;
                },
                [],
            );
            const item = giveItemChoices.find((candidate) => candidate.id === questLink.itemId);

            itemsById.set(questLink.itemId, {
                itemId: questLink.itemId,
                normalizedName: item?.normalizedName ?? questLink.itemId,
                name: item?.name ?? questLink.questName,
                iconLink: item?.iconLink,
                gridImageLink: item?.gridImageLink,
                quests: [{ ...questLink }],
            });
        }
    }

    return Array.from(itemsById.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function compareDerivedQuest(a: DerivedQuestItemQuest, b: DerivedQuestItemQuest): number {
    const statusOrder: Record<DerivedQuestItemStatus, number> = {
        available: 0,
        future: 1,
        completed: 2,
        ignored: 3,
    };

    if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
    }

    if (a.prerequisiteDepth !== b.prerequisiteDepth) {
        return a.prerequisiteDepth - b.prerequisiteDepth;
    }

    if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
    }

    if ((a.minPlayerLevel ?? 0) !== (b.minPlayerLevel ?? 0)) {
        return (a.minPlayerLevel ?? 0) - (b.minPlayerLevel ?? 0);
    }

    return a.questName.localeCompare(b.questName);
}

export function deriveQuestItemState(
    entry: QuestItemIndexEntry,
    options: QuestItemDeriveOptions,
): DerivedQuestItemState {
    const { completedQuests, ignoredQuests, pinnedQuests, playerLevel } = options;
    const questAvailabilityById = buildQuestAvailabilityMap(options.quests);
    const availabilityProfile: QuestAvailabilityProfile = {
        completedQuests,
        playerLevel,
        prestigeLevel: options.prestigeLevel,
        faction: options.faction,
        traderLoyaltyLevels: options.traderLoyaltyLevels,
    };

    const relatedQuests = entry.quests
        .map<DerivedQuestItemQuest>((quest) => {
            const isCompleted = !!completedQuests[quest.questId];
            const isIgnored = !!ignoredQuests[quest.questId];
            const isPinned = !!pinnedQuests[quest.questId];
            const availabilityQuest = questAvailabilityById.get(quest.questId);
            const isAvailable =
                !!availabilityQuest &&
                isQuestAvailableForProfile(availabilityQuest, availabilityProfile, questAvailabilityById);

            let status: DerivedQuestItemStatus = "future";
            if (isCompleted) {
                status = "completed";
            } else if (isIgnored) {
                status = "ignored";
            } else if (isAvailable) {
                status = "available";
            }

            return {
                ...quest,
                status,
                isPinned,
                isActive: status === "available" || status === "future",
            };
        })
        .sort(compareDerivedQuest);

    const activeQuests = relatedQuests.filter((quest) => quest.isActive);
    const availableQuests = activeQuests.filter((quest) => quest.status === "available");
    const futureQuests = activeQuests.filter((quest) => quest.status === "future");
    const pinnedQuestsActive = activeQuests.filter((quest) => quest.isPinned);

    const activeQuestDepth =
        availableQuests.length > 0
            ? Math.min(...availableQuests.map((quest) => quest.prerequisiteDepth))
            : futureQuests.length > 0
            ? Math.min(...futureQuests.map((quest) => quest.prerequisiteDepth))
            : null;

    return {
        itemId: entry.itemId,
        normalizedName: entry.normalizedName,
        name: entry.name,
        iconLink: entry.iconLink,
        gridImageLink: entry.gridImageLink,
        activeQuestDepth,
        hasAvailableQuest: availableQuests.length > 0,
        availableQuestCount: availableQuests.length,
        futureQuestCount: futureQuests.length,
        pinnedQuestCount: pinnedQuestsActive.length,
        relatedQuestCount: activeQuests.length,
        requiredCount: activeQuests.reduce((sum, quest) => sum + quest.requiredCount, 0),
        requiredFirCount: activeQuests.reduce((sum, quest) => sum + quest.requiredFirCount, 0),
        pinnedRequiredCount: pinnedQuestsActive.reduce((sum, quest) => sum + quest.requiredCount, 0),
        pinnedRequiredFirCount: pinnedQuestsActive.reduce(
            (sum, quest) => sum + quest.requiredFirCount,
            0,
        ),
        relatedQuests,
    };
}

export function deriveQuestItemStates(
    questItemIndex: QuestItemIndexEntry[],
    options: QuestItemDeriveOptions,
): DerivedQuestItemState[] {
    return questItemIndex
        .map((entry) => deriveQuestItemState(entry, options))
        .filter((entry) => entry.requiredCount > 0 || entry.pinnedRequiredCount > 0);
}

export function compareQuestItemState(a: DerivedQuestItemState, b: DerivedQuestItemState): number {
    if (a.hasAvailableQuest !== b.hasAvailableQuest) {
        return a.hasAvailableQuest ? -1 : 1;
    }

    if ((a.activeQuestDepth ?? Number.MAX_SAFE_INTEGER) !== (b.activeQuestDepth ?? Number.MAX_SAFE_INTEGER)) {
        return (a.activeQuestDepth ?? Number.MAX_SAFE_INTEGER) - (b.activeQuestDepth ?? Number.MAX_SAFE_INTEGER);
    }

    if (a.relatedQuestCount !== b.relatedQuestCount) {
        return b.relatedQuestCount - a.relatedQuestCount;
    }

    return a.name.localeCompare(b.name);
}
