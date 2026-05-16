import type { ItemQuestVisibilityMode } from "@/lib/stores/useUserStore";
import type {
    FullQuest,
    FullQuestObjective,
    Quest,
    QuestObjectiveItemType,
    QuestPrerequisite,
} from "@/types";
import {
    buildQuestAvailabilityMap,
    isQuestAvailableForProfile,
    matchesFactionVisibility,
    type QuestAvailabilityProfile,
    type QuestAvailabilityQuest,
} from "./quest-availability";

type QuestWithGiveItemData = Pick<
    Quest,
    | "id"
    | "name"
    | "normalizedName"
    | "wikiLink"
    | "minPlayerLevel"
    | "trader"
    | "taskRequirements"
    | "objectives"
>;

type FullQuestWithGiveItemData = Pick<
    FullQuest,
    | "id"
    | "name"
    | "normalizedName"
    | "wikiLink"
    | "minPlayerLevel"
    | "trader"
    | "taskRequirements"
    | "objectives"
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

export interface QuestAnyOfGroupEntry {
    groupId: string;
    questId: string;
    questName: string;
    objectiveLabel: string;
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
    isFirRequired: boolean;
    items: Array<{
        id: string;
        name: string;
        normalizedName: string;
        iconLink?: string;
        gridImageLink?: string;
    }>;
}

export type DerivedQuestItemStatus = "available" | "future" | "completed" | "ignored";
export type DerivedQuestVisibilityBucket = "pinned" | "available" | "nextLayer" | "future" | "fir";

export interface DerivedQuestItemQuest extends QuestItemLink {
    status: DerivedQuestItemStatus;
    isPinned: boolean;
    isActive: boolean;
    isPinnedOverride: boolean;
    isFutureFirOverride: boolean;
    isVisibleByMode: boolean;
    visibilityBucket: DerivedQuestVisibilityBucket;
    distanceFromAvailable: number | null;
}

export interface DerivedQuestItemState {
    itemId: string;
    normalizedName: string;
    name: string;
    iconLink?: string;
    gridImageLink?: string;
    activeQuestDepth: number | null;
    hasAvailableQuest: boolean;
    hasPinnedQuest: boolean;
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

export interface DerivedQuestAnyOfGroup {
    groupId: string;
    questId: string;
    questName: string;
    objectiveLabel: string;
    questNormalizedName: string;
    questWikiLink?: string | null;
    traderId: string;
    traderName: string;
    traderImageLink?: string | null;
    traderImage4xLink?: string | null;
    prerequisiteDepth: number;
    minPlayerLevel?: number | null;
    requiredCount: number;
    requiredFirCount: number;
    isFirRequired: boolean;
    items: QuestAnyOfGroupEntry["items"];
    status: DerivedQuestItemStatus;
    isPinned: boolean;
    isPinnedOverride: boolean;
    isFutureFirOverride: boolean;
    isVisibleByMode: boolean;
    visibilityBucket: DerivedQuestVisibilityBucket;
    distanceFromAvailable: number | null;
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
    visibilityMode?: ItemQuestVisibilityMode;
    customLookahead?: number;
    customLevelLookahead?: number;
    showFutureFir?: boolean;
    showIgnored?: boolean;
    showKappa?: boolean;
    showLightkeeper?: boolean;
}

interface QuestItemDeriveContext {
    completedQuests: Record<string, boolean>;
    ignoredQuests: Record<string, boolean>;
    pinnedQuests: Record<string, boolean>;
    faction: QuestAvailabilityProfile["faction"];
    availableQuestIds: Set<string>;
    nextLayerQuestIds: Set<string>;
    futureQuestIds: Set<string>;
    itemDistanceFromAvailable: ReadonlyMap<string, number>;
    visibilityMode: ItemQuestVisibilityMode;
    playerLevel: number;
    customLookahead: number;
    customLevelLookahead: number;
    showFutureFir: boolean;
    showIgnored: boolean;
    showKappa: boolean;
    showLightkeeper: boolean;
    questsById: ReadonlyMap<string, QuestAvailabilityQuest>;
}

function isGiveItemObjective(
    objective: QuestObjectiveItemType | FullQuestObjective,
): objective is QuestObjectiveItemType {
    return objective.type === "giveItem" && "items" in objective;
}

function isFindItemObjective(
    objective: FullQuestObjective,
): objective is FullQuestObjective & { type: "findItem" } {
    return objective.type === "findItem";
}

function stripGiveItemDescriptionPrefix(description: string): string {
    let final = description;
    final = final.replace(/^Hand over the found in raid items:\s*/i, "");
    final = final.replace(/^Hand over the found in raid item:\s*/i, "");
    final = final.replace(/^Hand over the found in raid\s*/i, "");
    final = final.trim();

    // Capitalize first letter
    final = final.charAt(0).toUpperCase() + final.slice(1);

    return final;
}

function formatAnyOfObjectiveLabel(
    objective: QuestObjectiveItemType,
    previousObjective: FullQuestObjective | null,
): string {
    const strippedDescription = stripGiveItemDescriptionPrefix(objective.description);
    const fallbackDescription =
        previousObjective && isFindItemObjective(previousObjective)
            ? previousObjective.description.trim()
            : "";

    const labelDescription = strippedDescription || fallbackDescription || "Any of these items";

    return labelDescription;
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
                    traderImageLink:
                        "imageLink" in quest.trader ? (quest.trader.imageLink ?? null) : null,
                    traderImage4xLink:
                        "image4xLink" in quest.trader ? (quest.trader.image4xLink ?? null) : null,
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

            const giveItemChoices = quest.objectives.reduce<
                Array<QuestObjectiveItemType["items"][number]>
            >((acc, objective) => {
                if (isGiveItemObjective(objective)) {
                    acc.push(...objective.items);
                }
                return acc;
            }, []);
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

export function buildQuestAnyOfGroups(quests: QuestItemSource[]): QuestAnyOfGroupEntry[] {
    const depthMap = getQuestDepthMap(quests);
    const groups: QuestAnyOfGroupEntry[] = [];

    for (const quest of quests) {
        for (const [objectiveIndex, objective] of quest.objectives.entries()) {
            if (!isGiveItemObjective(objective) || objective.items.length <= 1) continue;

            groups.push({
                groupId: `${quest.id}:${objective.id}`,
                questId: quest.id,
                questName: quest.name,
                objectiveLabel: formatAnyOfObjectiveLabel(
                    objective,
                    objectiveIndex > 0 ? quest.objectives[objectiveIndex - 1] : null,
                ),
                questNormalizedName: quest.normalizedName,
                questWikiLink: quest.wikiLink,
                traderId: quest.trader.id,
                traderName: quest.trader.name,
                traderImageLink:
                    "imageLink" in quest.trader ? (quest.trader.imageLink ?? null) : null,
                traderImage4xLink:
                    "image4xLink" in quest.trader ? (quest.trader.image4xLink ?? null) : null,
                prerequisiteQuestIds: quest.taskRequirements.map((req) => req.task.id),
                prerequisiteDepth: depthMap.get(quest.id) ?? 0,
                minPlayerLevel: quest.minPlayerLevel ?? null,
                requiredCount: objective.count,
                requiredFirCount: objective.foundInRaid ? objective.count : 0,
                isFirRequired: objective.foundInRaid,
                items: objective.items.map((item) => ({
                    id: item.id,
                    name: item.name,
                    normalizedName: item.normalizedName,
                    iconLink: item.iconLink,
                    gridImageLink: item.gridImageLink,
                })),
            });
        }
    }

    return groups.sort((a, b) => {
        if (a.prerequisiteDepth !== b.prerequisiteDepth) {
            return a.prerequisiteDepth - b.prerequisiteDepth;
        }
        if ((a.minPlayerLevel ?? 0) !== (b.minPlayerLevel ?? 0)) {
            return (a.minPlayerLevel ?? 0) - (b.minPlayerLevel ?? 0);
        }
        return a.questName.localeCompare(b.questName);
    });
}

function compareDerivedQuest(a: DerivedQuestItemQuest, b: DerivedQuestItemQuest): number {
    const bucketOrder: Record<DerivedQuestVisibilityBucket, number> = {
        pinned: 0,
        available: 1,
        nextLayer: 2,
        fir: 3,
        future: 4,
    };

    if (bucketOrder[a.visibilityBucket] !== bucketOrder[b.visibilityBucket]) {
        return bucketOrder[a.visibilityBucket] - bucketOrder[b.visibilityBucket];
    }

    const statusOrder: Record<DerivedQuestItemStatus, number> = {
        available: 0,
        future: 1,
        completed: 2,
        ignored: 3,
    };

    if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
    }

    if (
        (a.distanceFromAvailable ?? Number.MAX_SAFE_INTEGER) !==
        (b.distanceFromAvailable ?? Number.MAX_SAFE_INTEGER)
    ) {
        return (
            (a.distanceFromAvailable ?? Number.MAX_SAFE_INTEGER) -
            (b.distanceFromAvailable ?? Number.MAX_SAFE_INTEGER)
        );
    }

    if (a.prerequisiteDepth !== b.prerequisiteDepth) {
        return a.prerequisiteDepth - b.prerequisiteDepth;
    }

    if ((a.minPlayerLevel ?? 0) !== (b.minPlayerLevel ?? 0)) {
        return (a.minPlayerLevel ?? 0) - (b.minPlayerLevel ?? 0);
    }

    return a.questName.localeCompare(b.questName);
}

function buildLeadsToMap(quests: QuestAvailabilityQuest[]) {
    const leadsTo = new Map<string, string[]>();

    for (const quest of quests) {
        for (const requirement of quest.taskRequirements) {
            const ids = leadsTo.get(requirement.task.id) ?? [];
            ids.push(quest.id);
            leadsTo.set(requirement.task.id, ids);
        }
    }

    return leadsTo;
}

function getAvailableQuestIds(
    quests: QuestAvailabilityQuest[],
    availabilityProfile: QuestAvailabilityProfile,
): Set<string> {
    const questsById = buildQuestAvailabilityMap(quests);
    const availableQuestIds = new Set<string>();

    for (const quest of quests) {
        if (isQuestAvailableForProfile(quest, availabilityProfile, questsById)) {
            availableQuestIds.add(quest.id);
        }
    }

    return availableQuestIds;
}

function questMatchesBranchFilters(
    quest: QuestAvailabilityQuest,
    showKappa: boolean,
    showLightkeeper: boolean,
) {
    if (!showKappa && !showLightkeeper) return true;
    return (showKappa && !!quest.kappaRequired) || (showLightkeeper && !!quest.lightkeeperRequired);
}

function getItemDistanceFromAvailable(
    quests: QuestAvailabilityQuest[],
    availableQuestIds: ReadonlySet<string>,
    showKappa: boolean,
    showLightkeeper: boolean,
): Map<string, number> {
    const questsById = buildQuestAvailabilityMap(quests);
    const leadsToMap = buildLeadsToMap(quests);
    const distanceMap = new Map<string, number>();
    const queue = Array.from(availableQuestIds, (questId) => ({ questId, distance: 0 }));

    for (const questId of availableQuestIds) {
        distanceMap.set(questId, 0);
    }

    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const nextQuestId of leadsToMap.get(current.questId) ?? []) {
            const nextQuest = questsById.get(nextQuestId);
            if (!nextQuest) continue;
            if (!questMatchesBranchFilters(nextQuest, showKappa, showLightkeeper)) continue;

            const nextDistance = current.distance + (nextQuest.hasItemHandIn ? 1 : 0);
            const previousDistance = distanceMap.get(nextQuestId);
            if (previousDistance != null && previousDistance <= nextDistance) continue;

            distanceMap.set(nextQuestId, nextDistance);
            if (nextQuest.hasItemHandIn) {
                queue.push({ questId: nextQuestId, distance: nextDistance });
            } else {
                queue.unshift({ questId: nextQuestId, distance: nextDistance });
            }
        }
    }

    return distanceMap;
}

function getFutureQuestIds(
    quests: QuestAvailabilityQuest[],
    completedQuests: Record<string, boolean>,
    ignoredQuests: Record<string, boolean>,
    faction: QuestAvailabilityProfile["faction"],
    showIgnored: boolean,
    showKappa: boolean,
    showLightkeeper: boolean,
): Set<string> {
    const futureQuestIds = new Set<string>();

    for (const quest of quests) {
        if (completedQuests[quest.id]) continue;
        if (ignoredQuests[quest.id] && !showIgnored) continue;
        if (!matchesFactionVisibility(quest.factionName, faction)) continue;
        if (!questMatchesBranchFilters(quest, showKappa, showLightkeeper)) continue;
        futureQuestIds.add(quest.id);
    }

    return futureQuestIds;
}

function questMatchesItemVisibilityFilters(
    quest: QuestAvailabilityQuest,
    context: QuestItemDeriveContext,
) {
    return (
        matchesFactionVisibility(quest.factionName, context.faction) &&
        questMatchesBranchFilters(quest, context.showKappa, context.showLightkeeper)
    );
}

function createQuestItemDeriveContext(options: QuestItemDeriveOptions): QuestItemDeriveContext {
    const { completedQuests, ignoredQuests, pinnedQuests, playerLevel } = options;
    const visibilityMode = options.visibilityMode ?? "available";
    const customLookahead = Math.max(0, Math.floor(options.customLookahead ?? 5));
    const customLevelLookahead = Math.max(0, Math.floor(options.customLevelLookahead ?? 5));
    const showFutureFir = options.showFutureFir ?? false;
    const showIgnored = options.showIgnored ?? false;
    const showKappa = options.showKappa ?? false;
    const showLightkeeper = options.showLightkeeper ?? false;
    const questsById = buildQuestAvailabilityMap(options.quests);

    const availabilityProfile: QuestAvailabilityProfile = {
        completedQuests,
        playerLevel,
        prestigeLevel: options.prestigeLevel,
        faction: options.faction,
        traderLoyaltyLevels: options.traderLoyaltyLevels,
    };

    const availableQuestIds = new Set(
        Array.from(getAvailableQuestIds(options.quests, availabilityProfile)).filter((questId) => {
            const quest = questsById.get(questId);
            return quest ? questMatchesBranchFilters(quest, showKappa, showLightkeeper) : false;
        }),
    );
    const itemDistanceFromAvailable = getItemDistanceFromAvailable(
        options.quests,
        availableQuestIds,
        showKappa,
        showLightkeeper,
    );
    const nextLayerQuestIds = new Set<string>();

    for (const [questId, distance] of itemDistanceFromAvailable.entries()) {
        const quest = questsById.get(questId);
        if (quest?.hasItemHandIn && distance === 1) {
            nextLayerQuestIds.add(questId);
        }
    }

    return {
        completedQuests,
        ignoredQuests,
        pinnedQuests,
        faction: options.faction,
        availableQuestIds,
        nextLayerQuestIds,
        futureQuestIds: getFutureQuestIds(
            options.quests,
            completedQuests,
            ignoredQuests,
            options.faction,
            showIgnored,
            showKappa,
            showLightkeeper,
        ),
        itemDistanceFromAvailable,
        visibilityMode,
        playerLevel: options.playerLevel,
        customLookahead,
        customLevelLookahead,
        showFutureFir,
        showIgnored,
        showKappa,
        showLightkeeper,
        questsById,
    };
}

function isQuestVisibleByMode(quest: QuestItemLink, context: QuestItemDeriveContext): boolean {
    const { completedQuests, ignoredQuests, availableQuestIds, nextLayerQuestIds, futureQuestIds } =
        context;
    const availabilityQuest = context.questsById.get(quest.questId);

    if (completedQuests[quest.questId]) return false;
    if (ignoredQuests[quest.questId] && !context.showIgnored) return false;
    if (!availabilityQuest) return false;
    if (!questMatchesItemVisibilityFilters(availabilityQuest, context)) return false;

    if (availableQuestIds.has(quest.questId)) return true;

    switch (context.visibilityMode) {
        case "nextLayer":
            return (
                nextLayerQuestIds.has(quest.questId) ||
                ((quest.minPlayerLevel ?? Number.MAX_SAFE_INTEGER) <= context.playerLevel + 20 &&
                    futureQuestIds.has(quest.questId))
            );
        case "allFuture":
            return futureQuestIds.has(quest.questId);
        case "custom": {
            if (!futureQuestIds.has(quest.questId)) return false;

            const distance = context.itemDistanceFromAvailable.get(quest.questId);
            const inQuestLookahead = distance != null && distance <= context.customLookahead;
            const minPlayerLevel = quest.minPlayerLevel ?? null;
            const inLevelLookahead =
                minPlayerLevel != null &&
                minPlayerLevel <= context.playerLevel + context.customLevelLookahead;

            return inQuestLookahead || inLevelLookahead;
        }
        case "available":
        default:
            return false;
    }
}

function getQuestVisibilityBucket(
    quest: QuestItemLink,
    isVisibleByMode: boolean,
    isPinnedOverride: boolean,
    isFutureFirOverride: boolean,
    context: QuestItemDeriveContext,
): DerivedQuestVisibilityBucket {
    if (isPinnedOverride) return "pinned";
    if (context.availableQuestIds.has(quest.questId)) return "available";
    if (context.nextLayerQuestIds.has(quest.questId) && isVisibleByMode) return "nextLayer";
    if (isFutureFirOverride) return "fir";
    return "future";
}

function deriveQuestItemStateFromContext(
    entry: QuestItemIndexEntry,
    context: QuestItemDeriveContext,
): DerivedQuestItemState {
    const { completedQuests, ignoredQuests, pinnedQuests, showFutureFir } = context;

    const relatedQuests = entry.quests
        .map<DerivedQuestItemQuest | null>((quest) => {
            const isCompleted = !!completedQuests[quest.questId];
            const isIgnored = !!ignoredQuests[quest.questId];
            const isPinned = !!pinnedQuests[quest.questId];
            const availabilityQuest = context.questsById.get(quest.questId);
            const matchesVisibilityFilters =
                !!availabilityQuest && questMatchesItemVisibilityFilters(availabilityQuest, context);
            const isVisibleByMode = isQuestVisibleByMode(quest, context);
            const isPinnedOverride = matchesVisibilityFilters && isPinned && !isCompleted;
            const isFutureFirOverride =
                matchesVisibilityFilters &&
                showFutureFir &&
                quest.requiredFirCount > 0 &&
                !isCompleted &&
                !isIgnored &&
                !isVisibleByMode;
            const isActive = isVisibleByMode || isPinnedOverride || isFutureFirOverride;

            if (!isActive) {
                return null;
            }

            let status: DerivedQuestItemStatus = "future";
            if (isCompleted) {
                status = "completed";
            } else if (isIgnored) {
                status = "ignored";
            } else if (context.availableQuestIds.has(quest.questId)) {
                status = "available";
            }

            return {
                ...quest,
                status,
                isPinned,
                isActive,
                isPinnedOverride,
                isFutureFirOverride,
                isVisibleByMode,
                visibilityBucket: getQuestVisibilityBucket(
                    quest,
                    isVisibleByMode,
                    isPinnedOverride,
                    isFutureFirOverride,
                    context,
                ),
                distanceFromAvailable: context.itemDistanceFromAvailable.get(quest.questId) ?? null,
            };
        })
        .filter((quest): quest is DerivedQuestItemQuest => quest !== null)
        .sort(compareDerivedQuest);

    const activeQuests = relatedQuests.filter((quest) => quest.isActive);
    const availableQuests = activeQuests.filter((quest) => quest.status === "available");
    const futureQuests = activeQuests.filter((quest) => quest.status === "future");
    const pinnedActiveQuests = activeQuests.filter((quest) => quest.isPinnedOverride);

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
        hasPinnedQuest: pinnedActiveQuests.length > 0,
        availableQuestCount: availableQuests.length,
        futureQuestCount: futureQuests.length,
        pinnedQuestCount: pinnedActiveQuests.length,
        relatedQuestCount: activeQuests.length,
        requiredCount: activeQuests.reduce((sum, quest) => sum + quest.requiredCount, 0),
        requiredFirCount: activeQuests.reduce((sum, quest) => sum + quest.requiredFirCount, 0),
        pinnedRequiredCount: pinnedActiveQuests.reduce(
            (sum, quest) => sum + quest.requiredCount,
            0,
        ),
        pinnedRequiredFirCount: pinnedActiveQuests.reduce(
            (sum, quest) => sum + quest.requiredFirCount,
            0,
        ),
        relatedQuests,
    };
}

export function deriveQuestItemState(
    entry: QuestItemIndexEntry,
    options: QuestItemDeriveOptions,
): DerivedQuestItemState {
    return deriveQuestItemStateFromContext(entry, createQuestItemDeriveContext(options));
}

export function deriveQuestItemStates(
    questItemIndex: QuestItemIndexEntry[],
    options: QuestItemDeriveOptions,
): DerivedQuestItemState[] {
    const context = createQuestItemDeriveContext(options);

    return questItemIndex
        .map((entry) => deriveQuestItemStateFromContext(entry, context))
        .filter((entry) => entry.requiredCount > 0 || entry.pinnedRequiredCount > 0);
}

export function deriveQuestAnyOfGroups(
    groups: QuestAnyOfGroupEntry[],
    options: QuestItemDeriveOptions,
): DerivedQuestAnyOfGroup[] {
    const context = createQuestItemDeriveContext(options);

    return groups
        .map<DerivedQuestAnyOfGroup | null>((group) => {
            const isCompleted = !!context.completedQuests[group.questId];
            const isIgnored = !!context.ignoredQuests[group.questId];
            const isPinned = !!context.pinnedQuests[group.questId];
            const availabilityQuest = context.questsById.get(group.questId);
            const matchesVisibilityFilters =
                !!availabilityQuest && questMatchesItemVisibilityFilters(availabilityQuest, context);

            if (!availabilityQuest || !matchesVisibilityFilters) return null;

            const questLike: QuestItemLink = {
                itemId: group.items[0]?.id ?? group.groupId,
                questId: group.questId,
                questName: group.questName,
                questNormalizedName: group.questNormalizedName,
                questWikiLink: group.questWikiLink,
                traderId: group.traderId,
                traderName: group.traderName,
                traderImageLink: group.traderImageLink,
                traderImage4xLink: group.traderImage4xLink,
                prerequisiteQuestIds: group.prerequisiteQuestIds,
                prerequisiteDepth: group.prerequisiteDepth,
                minPlayerLevel: group.minPlayerLevel,
                requiredCount: group.requiredCount,
                requiredFirCount: group.requiredFirCount,
                totalObjectiveCount: group.requiredCount,
                isFirRequired: group.isFirRequired,
            };

            const isVisibleByMode = isQuestVisibleByMode(questLike, context);
            const isPinnedOverride = isPinned && !isCompleted;
            const isFutureFirOverride =
                context.showFutureFir &&
                group.requiredFirCount > 0 &&
                !isCompleted &&
                !isIgnored &&
                !isVisibleByMode;
            const isActive = isVisibleByMode || isPinnedOverride || isFutureFirOverride;

            if (!isActive) return null;

            let status: DerivedQuestItemStatus = "future";
            if (isCompleted) status = "completed";
            else if (isIgnored) status = "ignored";
            else if (context.availableQuestIds.has(group.questId)) status = "available";

            return {
                groupId: group.groupId,
                questId: group.questId,
                questName: group.questName,
                objectiveLabel: group.objectiveLabel,
                questNormalizedName: group.questNormalizedName,
                questWikiLink: group.questWikiLink,
                traderId: group.traderId,
                traderName: group.traderName,
                traderImageLink: group.traderImageLink,
                traderImage4xLink: group.traderImage4xLink,
                prerequisiteDepth: group.prerequisiteDepth,
                minPlayerLevel: group.minPlayerLevel,
                requiredCount: group.requiredCount,
                requiredFirCount: group.requiredFirCount,
                isFirRequired: group.isFirRequired,
                items: group.items,
                status,
                isPinned,
                isPinnedOverride,
                isFutureFirOverride,
                isVisibleByMode,
                visibilityBucket: getQuestVisibilityBucket(
                    questLike,
                    isVisibleByMode,
                    isPinnedOverride,
                    isFutureFirOverride,
                    context,
                ),
                distanceFromAvailable: context.itemDistanceFromAvailable.get(group.questId) ?? null,
            };
        })
        .filter((group): group is DerivedQuestAnyOfGroup => group !== null)
        .sort((a, b) => {
            const bucketOrder: Record<DerivedQuestVisibilityBucket, number> = {
                pinned: 0,
                available: 1,
                nextLayer: 2,
                fir: 3,
                future: 4,
            };
            if (bucketOrder[a.visibilityBucket] !== bucketOrder[b.visibilityBucket]) {
                return bucketOrder[a.visibilityBucket] - bucketOrder[b.visibilityBucket];
            }
            if (
                (a.distanceFromAvailable ?? Number.MAX_SAFE_INTEGER) !==
                (b.distanceFromAvailable ?? Number.MAX_SAFE_INTEGER)
            ) {
                return (
                    (a.distanceFromAvailable ?? Number.MAX_SAFE_INTEGER) -
                    (b.distanceFromAvailable ?? Number.MAX_SAFE_INTEGER)
                );
            }
            return a.questName.localeCompare(b.questName);
        });
}

export function compareQuestItemState(a: DerivedQuestItemState, b: DerivedQuestItemState): number {
    if (a.hasPinnedQuest !== b.hasPinnedQuest) {
        return a.hasPinnedQuest ? -1 : 1;
    }

    if (a.hasAvailableQuest !== b.hasAvailableQuest) {
        return a.hasAvailableQuest ? -1 : 1;
    }

    if (
        (a.activeQuestDepth ?? Number.MAX_SAFE_INTEGER) !==
        (b.activeQuestDepth ?? Number.MAX_SAFE_INTEGER)
    ) {
        return (
            (a.activeQuestDepth ?? Number.MAX_SAFE_INTEGER) -
            (b.activeQuestDepth ?? Number.MAX_SAFE_INTEGER)
        );
    }

    if (a.relatedQuestCount !== b.relatedQuestCount) {
        return b.relatedQuestCount - a.relatedQuestCount;
    }

    return a.name.localeCompare(b.name);
}
