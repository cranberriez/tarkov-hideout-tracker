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
    const { stations, items } = useDataContext();
    const { stationLevels, hiddenStations, completedRequirements } = useUserStore(
        useShallow((state) => ({ stationLevels: state.stationLevels, hiddenStations: state.hiddenStations, completedRequirements: state.completedRequirements })),
    );
    const questItemDetails = useMemo(() => {
        const details: Record<string, ItemDetails> = Object.fromEntries(
            (items ?? []).map((item) => [item.id, item]),
        );
        const addItem = (item: { id: string; name: string; normalizedName: string; iconLink?: string | null; gridImageLink?: string | null }) => {
            details[item.id] ??= { id: item.id, name: item.name, normalizedName: item.normalizedName, iconLink: item.iconLink ?? undefined, gridImageLink: item.gridImageLink ?? undefined };
        };
        quests.forEach((quest) => quest.objectives.forEach((objective) => {
            if ("items" in objective && Array.isArray(objective.items)) objective.items.forEach(addItem);
            objective.requiredKeys?.flat().forEach(addItem);
            if ("questItem" in objective && objective.questItem) addItem(objective.questItem);
            if ("item" in objective && objective.item) addItem(objective.item);
            if ("containsAll" in objective && Array.isArray(objective.containsAll)) objective.containsAll.forEach(addItem);
            if ("useAny" in objective && Array.isArray(objective.useAny)) objective.useAny.forEach(addItem);
        }));
        return details;
    }, [items, quests]);
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
