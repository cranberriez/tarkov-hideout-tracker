import type { QuestVisibilityMode } from "../../lib/stores/useUserStore";
import type { QuestAvailabilityProfile } from "../../lib/utils/quest-availability";
import {
    isQuestAvailableForProfile,
    matchesFactionVisibility,
} from "../../lib/utils/quest-availability";
import { isQuestDisabledByCompletedFailedRequirement } from "../../lib/utils/quest-failures";
import {
    hasFirGiveItemObjectives,
    hasGiveItemObjectives,
} from "../../lib/utils/quest-item-index";
import { questMatchesSelectedMapGroups } from "./quest-map-groups";
import type { QuestDataIndex } from "./quest-data-index";

export interface LegacyQuestProfileSnapshot extends QuestAvailabilityProfile {
    ignoredQuests: Readonly<Record<string, boolean>>;
    pinnedQuests: Readonly<Record<string, boolean>>;
}

export interface LegacyQuestFilterSnapshot {
    searchQuery: string;
    selectedTraderIds: ReadonlySet<string>;
    selectedMapKeys: ReadonlySet<string>;
    showKappa: boolean;
    showLightkeeper: boolean;
    hideCompleted: boolean;
    visibilityMode: QuestVisibilityMode;
    activeDepth: number;
    showHandInOnly: boolean;
    showFirHandInOnly: boolean;
    showPinnedOnly: boolean;
    showIgnored: boolean;
}

export interface LegacyQuestSelection {
    filteredQuestIds: string[];
    kappaQuestIds: Set<string>;
    lightkeeperQuestIds: Set<string>;
    completedCount: number;
    failedCount: number;
}

function collectTransitivePrerequisiteIds(
    rootIds: Iterable<string>,
    index: QuestDataIndex,
) {
    const result = new Set(rootIds);
    const pending = [...result];

    while (pending.length > 0) {
        const questId = pending.pop()!;
        for (const prerequisiteId of index.prerequisiteIdsByQuestId.get(questId) ?? []) {
            if (result.has(prerequisiteId)) continue;
            result.add(prerequisiteId);
            pending.push(prerequisiteId);
        }
    }

    return result;
}

function selectActiveDepthQuestIds(
    index: QuestDataIndex,
    profile: LegacyQuestProfileSnapshot,
    activeDepth: number,
) {
    const result = new Set<string>();
    const pending: Array<{ questId: string; depth: number }> = [];
    const maxDepth = Math.max(0, Math.floor(activeDepth));

    for (const quest of index.quests) {
        if (!isQuestAvailableForProfile(quest, profile, index.questsById)) continue;
        result.add(quest.id);
        pending.push({ questId: quest.id, depth: 0 });
    }

    while (pending.length > 0) {
        const current = pending.shift()!;
        if (current.depth >= maxDepth) continue;

        for (const nextQuestId of index.leadsToByQuestId.get(current.questId) ?? []) {
            if (result.has(nextQuestId)) continue;
            result.add(nextQuestId);
            pending.push({ questId: nextQuestId, depth: current.depth + 1 });
        }
    }

    return result;
}

export function selectLegacyQuests(
    index: QuestDataIndex,
    profile: LegacyQuestProfileSnapshot,
    filters: LegacyQuestFilterSnapshot,
): LegacyQuestSelection {
    const kappaQuestIds = collectTransitivePrerequisiteIds(
        index.quests.filter((quest) => quest.kappaRequired).map((quest) => quest.id),
        index,
    );
    const lightkeeperQuestIds = collectTransitivePrerequisiteIds(
        index.quests.filter((quest) => quest.lightkeeperRequired).map((quest) => quest.id),
        index,
    );
    const activeDepthQuestIds = filters.visibilityMode === "activeDepth"
        ? selectActiveDepthQuestIds(index, profile, filters.activeDepth)
        : null;
    const normalizedSearch = filters.searchQuery.trim().toLowerCase();

    const filteredQuestIds = index.quests.filter((quest) => {
        if (
            normalizedSearch &&
            !quest.name.toLowerCase().includes(normalizedSearch) &&
            !quest.trader.name.toLowerCase().includes(normalizedSearch) &&
            !(quest.map?.name.toLowerCase().includes(normalizedSearch) ?? false)
        ) return false;

        const resolved =
            profile.completedQuests[quest.id] ||
            profile.failedQuests?.[quest.id] ||
            isQuestDisabledByCompletedFailedRequirement(quest, profile.completedQuests);

        if (filters.hideCompleted && resolved) return false;
        if (!filters.showIgnored && profile.ignoredQuests[quest.id]) return false;
        if (
            filters.visibilityMode === "hideLocked" &&
            !isQuestAvailableForProfile(quest, profile, index.questsById)
        ) return false;
        if (filters.visibilityMode === "activeDepth" && !activeDepthQuestIds?.has(quest.id)) {
            return false;
        }
        if (filters.showPinnedOnly && !profile.pinnedQuests[quest.id]) return false;
        if (filters.showHandInOnly && !hasGiveItemObjectives(quest)) return false;
        if (filters.showFirHandInOnly && !hasFirGiveItemObjectives(quest)) return false;
        if (
            filters.selectedTraderIds.size > 0 &&
            !filters.selectedTraderIds.has(quest.trader.id)
        ) return false;
        if (!matchesFactionVisibility(quest.factionName, profile.faction)) return false;
        if (
            (filters.showKappa || filters.showLightkeeper) &&
            !(
                (filters.showKappa && kappaQuestIds.has(quest.id)) ||
                (filters.showLightkeeper && lightkeeperQuestIds.has(quest.id))
            )
        ) return false;
        if (!questMatchesSelectedMapGroups(quest, filters.selectedMapKeys)) return false;

        return true;
    }).map((quest) => quest.id);

    return {
        filteredQuestIds,
        kappaQuestIds,
        lightkeeperQuestIds,
        completedCount: index.quests.filter(
            (quest) => !quest.removed && profile.completedQuests[quest.id],
        ).length,
        failedCount: index.quests.filter(
            (quest) => !quest.removed && profile.failedQuests?.[quest.id],
        ).length,
    };
}
