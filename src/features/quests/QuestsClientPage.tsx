"use client";

import { useMemo, type ReactNode } from "react";
import type { QuestSummary } from "@/types/quests";
import type { ItemSummary } from "@/types/items";
import { QuestActionsProvider } from "./QuestActionsContext";
import { QuestCascadeConfirmDialog } from "./components/QuestCascadeConfirmDialog";
import { QuestWorkspaceProvider } from "./workspace/QuestWorkspaceContext";
import { QuestWorkspace } from "./workspace/QuestWorkspace";
import { buildQuestDataIndex } from "./quest-data-index";

interface QuestsClientPageProps {
	quests: QuestSummary[];
	devQuery: string | null;
	/** The routed detail pane (`/quests` prompt or `/quests/[questId]`). */
	children: ReactNode;
}

const NO_ITEMS: Readonly<Record<string, ItemSummary>> = {};

export function QuestsClientPage({ quests, devQuery, children }: QuestsClientPageProps) {
	const questDataIndex = useMemo(() => buildQuestDataIndex(quests), [quests]);

	return (
		<QuestActionsProvider questDataIndex={questDataIndex} itemById={NO_ITEMS}>
			<QuestWorkspaceProvider quests={quests} questDataIndex={questDataIndex} devQuery={devQuery}>
				<QuestWorkspace quests={quests}>{children}</QuestWorkspace>
			</QuestWorkspaceProvider>
			<QuestCascadeConfirmDialog />
		</QuestActionsProvider>
	);
}
