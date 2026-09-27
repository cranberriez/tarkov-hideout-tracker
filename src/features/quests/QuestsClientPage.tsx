"use client";

import { useMemo, type ReactNode } from "react";
import type { FullQuest } from "@/types/quests";
import type { ItemSummary } from "@/types/items";
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

    return (
        <QuestActionsProvider questDataIndex={questDataIndex} itemById={itemById}>
            <QuestWorkspaceProvider quests={quests} questDataIndex={questDataIndex} devQuery={devQuery}>
                <QuestWorkspace quests={quests}>{children}</QuestWorkspace>
            </QuestWorkspaceProvider>
            <QuestCascadeConfirmDialog />
        </QuestActionsProvider>
    );
}
