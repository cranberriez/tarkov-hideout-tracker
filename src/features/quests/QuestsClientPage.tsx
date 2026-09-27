"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { FullQuest } from "@/types/quests";
import type { ItemSummary } from "@/types/items";
import { ItemDetailModal } from "@/features/items/item-detail/LazyItemDetailModal";
import { QuestActionsProvider } from "./QuestActionsContext";
import { QuestCascadeConfirmDialog } from "./components/QuestCascadeConfirmDialog";
import { QuestWorkspaceProvider } from "./workspace/QuestWorkspaceContext";
import { QuestWorkspace } from "./workspace/QuestWorkspace";
import { buildQuestDataIndex } from "./quest-data-index";

interface QuestsClientPageProps {
    quests: FullQuest[];
    items: ItemSummary[] | null;
    devQuery: string | null;
    /** The routed detail pane (`/quests` prompt or `/quests/[questId]`). */
    children: ReactNode;
}

export function QuestsClientPage({
    quests,
    items,
    devQuery,
    children,
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
        <QuestActionsProvider questDataIndex={questDataIndex} itemById={itemById} onItemClick={setSelectedItemId}>
            <QuestWorkspaceProvider quests={quests} questDataIndex={questDataIndex} devQuery={devQuery}>
                <QuestWorkspace quests={quests}>{children}</QuestWorkspace>
            </QuestWorkspaceProvider>
            <ItemDetailModal item={selectedItem} isOpen={!!selectedItem} onClose={() => setSelectedItemId(null)} />
            <QuestCascadeConfirmDialog />
        </QuestActionsProvider>
    );
}
