"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { FullQuest, ItemDetails } from "@/types";
import type { QuestAnyOfGroupEntry, QuestItemIndexEntry, QuestRewardIndexEntry } from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { useDataContext } from "@/app/(data)/_dataContext";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";
import { QuestsProvider } from "./QuestsContext";
import { QuestCascadeConfirmDialog } from "./components/QuestCascadeConfirmDialog";
import { QuestWorkspaceProvider } from "./workspace/QuestWorkspaceContext";
import { QuestWorkspace } from "./workspace/QuestWorkspace";
import { buildQuestDataIndex } from "./quest-data-index";

interface QuestsClientPageProps {
    quests: FullQuest[];
    updatedAt: number;
    questItemIndex: QuestItemIndexEntry[];
    questRewardIndex: QuestRewardIndexEntry[];
    questAnyOfGroups: QuestAnyOfGroupEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
    initialQuestId?: string | null;
}

export function QuestsClientPage({ quests, updatedAt, questItemIndex, questRewardIndex, questAnyOfGroups, questAvailabilityQuests, initialQuestId = null }: QuestsClientPageProps) {
    void updatedAt;
    const questDataIndex = useMemo(() => buildQuestDataIndex(quests), [quests]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const { stations, itemById } = useDataContext();
    const { stationLevels, hiddenStations, completedRequirements } = useUserStore(
        useShallow((state) => ({ stationLevels: state.stationLevels, hiddenStations: state.hiddenStations, completedRequirements: state.completedRequirements })),
    );
    const selectedItem: ItemDetails | null = selectedItemId
        ? itemById[selectedItemId] ?? null
        : null;

    return (
        <QuestsProvider quests={quests} questDataIndex={questDataIndex} onItemClick={setSelectedItemId}>
            <QuestWorkspaceProvider quests={quests} questDataIndex={questDataIndex} initialQuestId={initialQuestId}>
                <QuestWorkspace quests={quests} />
            </QuestWorkspaceProvider>
            <ItemDetailModal item={selectedItem} isOpen={!!selectedItem} onClose={() => setSelectedItemId(null)} stations={stations ?? []} stationLevels={stationLevels} hiddenStations={hiddenStations} completedRequirements={completedRequirements} questItemIndex={questItemIndex} questRewardIndex={questRewardIndex} questAnyOfGroups={questAnyOfGroups} questAvailabilityQuests={questAvailabilityQuests} />
            <QuestCascadeConfirmDialog />
        </QuestsProvider>
    );
}
