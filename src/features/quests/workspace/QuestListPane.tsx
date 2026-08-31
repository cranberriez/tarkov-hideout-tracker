"use client";

import { useMemo } from "react";
import { GroupedQuestRows } from "./GroupedQuestRows";
import { buildSortedQuestListModel } from "./quest-list-model";
import { QuestFilterSelectionPane } from "./QuestFilterBar";
import { QuestHistoryList } from "./QuestHistoryList";
import { useQuestGroupCollapse } from "./useQuestGroupCollapse";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestListPane() {
    const {
        filteredQuests,
        questDataIndex,
        selectedQuestId,
        setSelectedQuestId,
        highlightedQuestId,
        listMode,
        openFilter,
        quests,
        selectedTraderIds,
        groupByTrader,
        groupByLoyaltyLevel,
        sortMode,
        statusByQuestId,
    } = useQuestWorkspace();
    const { collapsedGroupIds, toggleGroup } = useQuestGroupCollapse();
    const showTraderGroups = groupByTrader && selectedTraderIds.size === 0;
    const model = useMemo(() => buildSortedQuestListModel({
        quests: filteredQuests,
        allQuests: quests,
        statusByQuestId,
        groupByTrader: showTraderGroups,
        groupByLoyaltyLevel,
        sortMode,
        questOrderById: questDataIndex.questOrderById,
        unlockImpactById: questDataIndex.unlockImpactById,
    }), [filteredQuests, groupByLoyaltyLevel, questDataIndex.questOrderById, questDataIndex.unlockImpactById, quests, showTraderGroups, sortMode, statusByQuestId]);

    if (openFilter) return <QuestFilterSelectionPane section={openFilter} />;
    if (listMode === "history") return <QuestHistoryList />;

    return (
        <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth bg-[#0b0c0e]">
            <GroupedQuestRows
                model={model}
                collapsedGroupIds={collapsedGroupIds}
                onToggleGroup={toggleGroup}
                selectedQuestId={selectedQuestId}
                highlightedQuestId={highlightedQuestId}
                onSelectQuest={setSelectedQuestId}
            />
            {model.questCount === 0 && (
                <div className="border-b border-dashed border-white/10 px-5 py-14 text-center text-sm text-gray-600">
                    No quests match these filters.
                </div>
            )}
        </div>
    );
}
