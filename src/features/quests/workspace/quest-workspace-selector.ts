import type { FullQuest } from "../../../types";
import type { QuestWorkspaceLockedFilterSettings } from "../../../lib/stores/useUserStore";
import { questMatchesTraderRequirementProfile } from "../../../lib/utils/quest-trader-gates";
import { questMatchesSelectedMapGroups } from "../quest-map-groups";
import {
    buildNextTaskCountGateByGroup,
    getQuestObjectiveCategories,
    getQuestWorkspaceStatus,
    isUpcomingLockedQuest,
    questMatchesLockedFilters,
    type QuestObjectiveCategory,
    type QuestWorkspaceProfile,
    type QuestWorkspaceStatus,
    type QuestWorkspaceStatusInfo,
} from "./quest-workspace-utils";

export type QuestProfileSnapshot = QuestWorkspaceProfile;

export interface QuestWorkspaceSelectionOptions {
    selectedTraderIds: ReadonlySet<string>;
    filterByTraderRequirements: boolean;
    selectedMapKeys: ReadonlySet<string>;
    selectedStatuses: ReadonlySet<QuestWorkspaceStatus>;
    lockedFilters: QuestWorkspaceLockedFilterSettings;
    selectedObjectiveCategories: ReadonlySet<QuestObjectiveCategory>;
    hiddenQuests: Readonly<Record<string, boolean>>;
    showHiddenQuests: boolean;
    retainedCompletedQuestIds: ReadonlySet<string>;
    searchQuery: string;
}

export interface QuestWorkspaceSelection {
    statusByQuestId: Map<string, QuestWorkspaceStatusInfo>;
    upcomingLockedQuestIds: Set<string>;
    filteredQuestIds: string[];
}

/** Pure workspace selector. It retains quest identity in the shared index and returns IDs for rendering. */
export function selectWorkspaceQuests(
    quests: readonly FullQuest[],
    questsById: Map<string, FullQuest>,
    profile: QuestProfileSnapshot,
    options: QuestWorkspaceSelectionOptions,
): QuestWorkspaceSelection {
    const statusByQuestId = new Map(
        quests.map((quest) => [quest.id, getQuestWorkspaceStatus(quest, profile, questsById)]),
    );
    const nextTaskCountGateByGroup = buildNextTaskCountGateByGroup(statusByQuestId.values());
    const upcomingLockedQuestIds = new Set(
        quests
            .filter((quest) => {
                const status = statusByQuestId.get(quest.id);
                return status && isUpcomingLockedQuest(
                    status,
                    options.lockedFilters,
                    nextTaskCountGateByGroup,
                );
            })
            .map((quest) => quest.id),
    );
    const normalizedSearch = options.searchQuery.trim().toLowerCase();
    const onlyActiveSelected = options.selectedStatuses.size === 1
        && options.selectedStatuses.has("active");

    const filteredQuestIds = quests.filter((quest) => {
        if (!options.showHiddenQuests && options.hiddenQuests[quest.id]) return false;
        if (
            options.selectedTraderIds.size > 0
            && !options.selectedTraderIds.has(quest.trader.id)
        ) return false;
        if (
            options.filterByTraderRequirements
            && !questMatchesTraderRequirementProfile(quest, profile)
        ) return false;
        if (
            options.selectedMapKeys.size > 0
            && !questMatchesSelectedMapGroups(quest, options.selectedMapKeys)
        ) return false;

        const status = statusByQuestId.get(quest.id);
        if (
            status
            && !options.selectedStatuses.has(status.status)
            && !(
                onlyActiveSelected
                && status.status === "completed"
                && options.retainedCompletedQuestIds.has(quest.id)
            )
        ) return false;
        if (
            status?.status === "locked"
            && options.selectedStatuses.has("locked")
            && !questMatchesLockedFilters(
                status,
                options.lockedFilters,
                nextTaskCountGateByGroup,
            )
        ) return false;
        if (options.selectedObjectiveCategories.size > 0) {
            const categories = getQuestObjectiveCategories(quest);
            if (![...options.selectedObjectiveCategories].some((category) => categories.has(category))) {
                return false;
            }
        }
        if (normalizedSearch) {
            const haystack = `${quest.name} ${quest.trader.name} ${quest.map?.name ?? ""} ${quest.objectives.map((objective) => objective.description).join(" ")}`.toLowerCase();
            if (!haystack.includes(normalizedSearch)) return false;
        }
        return true;
    }).map((quest) => quest.id);

    return { statusByQuestId, upcomingLockedQuestIds, filteredQuestIds };
}
