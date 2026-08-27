"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { FullQuest, ItemDetails } from "@/types";
import type { QuestAnyOfGroupEntry, QuestItemIndexEntry } from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { useDataContext } from "@/app/(data)/_dataContext";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";
import { QuestsProvider } from "./QuestsContext";
import { QuestCascadeConfirmDialog } from "./components/QuestCascadeConfirmDialog";
import { QuestWorkspaceProvider } from "./workspace/QuestWorkspaceContext";
import { QuestWorkspace } from "./workspace/QuestWorkspace";

interface QuestsClientPageProps {
    quests: FullQuest[];
    updatedAt: number;
    questItemIndex: QuestItemIndexEntry[];
    questAnyOfGroups: QuestAnyOfGroupEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
}

export function QuestsClientPage({ quests, updatedAt, questItemIndex, questAnyOfGroups, questAvailabilityQuests }: QuestsClientPageProps) {
    void updatedAt;
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const { stations } = useDataContext();
    const { stationLevels, hiddenStations, completedRequirements } = useUserStore(
        useShallow((state) => ({ stationLevels: state.stationLevels, hiddenStations: state.hiddenStations, completedRequirements: state.completedRequirements })),
    );
    const questItemDetails = useMemo(() => {
        const details: Record<string, ItemDetails> = {};
        quests.forEach((quest) => quest.objectives.forEach((objective) => {
            if (!("items" in objective) || !Array.isArray(objective.items)) return;
            objective.items.forEach((item) => {
                details[item.id] ??= { id: item.id, name: item.name, normalizedName: item.normalizedName, iconLink: item.iconLink, gridImageLink: item.gridImageLink };
            });
        }));
        return details;
    }, [quests]);
    const selectedItem = selectedItemId ? questItemDetails[selectedItemId] ?? null : null;

    return (
        <QuestsProvider quests={quests} onItemClick={setSelectedItemId}>
            <QuestWorkspaceProvider quests={quests}>
                <QuestWorkspace quests={quests} />
            </QuestWorkspaceProvider>
            <ItemDetailModal item={selectedItem} isOpen={!!selectedItem} onClose={() => setSelectedItemId(null)} stations={stations ?? []} stationLevels={stationLevels} hiddenStations={hiddenStations} completedRequirements={completedRequirements} questItemIndex={questItemIndex} questAnyOfGroups={questAnyOfGroups} questAvailabilityQuests={questAvailabilityQuests} />
            <QuestCascadeConfirmDialog />
        </QuestsProvider>
    );
}
