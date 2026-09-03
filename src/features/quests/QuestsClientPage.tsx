"use client";

import { useMemo, useState } from "react";
import type { FullQuest } from "@/types/quests";
import type { ItemSummary } from "@/types/items";
import type { QuestAnyOfGroupEntry, QuestItemIndexEntry, QuestRewardIndexEntry } from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";
import { QuestsProvider } from "./QuestsContext";
import { QuestCascadeConfirmDialog } from "./components/QuestCascadeConfirmDialog";
import { QuestWorkspaceProvider } from "./workspace/QuestWorkspaceContext";
import { QuestWorkspace } from "./workspace/QuestWorkspace";
import { buildQuestDataIndex } from "./quest-data-index";

interface QuestsClientPageProps {
    quests: FullQuest[];
    items: ItemSummary[] | null;
    updatedAt: number | null;
    questItemIndex: QuestItemIndexEntry[];
    questRewardIndex: QuestRewardIndexEntry[];
    questAnyOfGroups: QuestAnyOfGroupEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
    initialQuestId?: string | null;
}

export function QuestsClientPage({
    quests,
    items,
    initialQuestId = null,
}: QuestsClientPageProps) {
    const questDataIndex = useMemo(() => buildQuestDataIndex(quests), [quests]);
    const itemById = useMemo(
        () => Object.fromEntries((items ?? []).map((item) => [item.id, item])) as Record<string, ItemSummary>,
        [items],
    );
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const selectedItem: ItemSummary | null = selectedItemId
        ? itemById[selectedItemId] ?? null
        : null;

    return (
        <QuestsProvider quests={quests} questDataIndex={questDataIndex} itemById={itemById} onItemClick={setSelectedItemId}>
            <QuestWorkspaceProvider quests={quests} questDataIndex={questDataIndex} initialQuestId={initialQuestId}>
                <QuestWorkspace quests={quests} />
            </QuestWorkspaceProvider>
            <ItemDetailModal item={selectedItem} isOpen={!!selectedItem} onClose={() => setSelectedItemId(null)} />
            <QuestCascadeConfirmDialog />
        </QuestsProvider>
    );
}
