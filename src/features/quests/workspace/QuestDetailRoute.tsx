"use client";

import { QuestDetailsPane } from "./QuestDetailsPane";
import { QuestNotFound } from "./QuestSelectionPrompt";
import { useQuestWorkspace } from "./QuestWorkspaceContext";
import { useQuestDetails } from "../useQuestDetails";
import { QuestItemsProvider } from "../QuestActionsContext";
import type { QuestDetailData } from "@/lib/query/quest-details";
import { toTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";

/**
 * `/quests/[questId]` content. Loads only the selected quest and its item presentations;
 * direct visits hydrate that same cache entry from the server route.
 */
export function QuestDetailRoute({
	questId,
	fallbackData,
	fallbackMode,
}: {
	questId: string;
	fallbackData?: QuestDetailData | null;
	fallbackMode?: TarkovJsonGameMode;
}) {
	const { questsById } = useQuestWorkspace();
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	const details = useQuestDetails([questId], questsById.has(questId), fallbackMode === mode ? fallbackData : null);
	const quest = details.quests[0];
	if (!questsById.has(questId) || details.missingQuestIds.includes(questId)) {
		return <QuestNotFound message="This quest is not part of the loaded quest data for the current game mode." />;
	}
	if (!quest)
		return (
			<div className="p-6" role={details.error ? "alert" : "status"}>
				{details.error ?? "Loading quest details…"}
				{details.error && (
					<button className="ml-2 underline" onClick={details.retry}>
						Retry
					</button>
				)}
			</div>
		);
	return (
		<QuestItemsProvider itemById={Object.fromEntries(details.items.map((item) => [item.id, item]))}>
			{details.error && (
				<div role="alert" className="p-3 text-sm">
					{details.error}{" "}
					<button className="underline" onClick={details.retry}>
						Retry
					</button>
				</div>
			)}
			{details.unresolvedItemIds.length > 0 && (
				<div role="status" className="p-3 text-sm">
					{details.unresolvedItemIds.length} referenced items are unavailable.
				</div>
			)}
			<QuestDetailsPane key={quest.id} quest={quest} />
		</QuestItemsProvider>
	);
}
