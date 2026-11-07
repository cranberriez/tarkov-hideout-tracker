"use client";

import type { ReactNode } from "react";
import { QuestDetailsPane } from "./QuestDetailsPane";
import { QuestNotFound } from "./QuestSelectionPrompt";
import { useOptionalQuestWorkspace, useQuestWorkspace } from "./QuestWorkspaceContext";
import { useQuestDetails } from "../useQuestDetails";
import { QuestItemsProvider } from "../QuestActionsContext";
import type { QuestDetailData } from "@/lib/query/quest-details";
import type { TarkovJsonGameMode } from "@/lib/game-mode";

/** Show the server identity while the workspace is loading or unavailable. */
export function QuestDetailIdentity({ children }: { children: ReactNode }) {
	return useOptionalQuestWorkspace() ? null : <div className="container mx-auto px-6 py-4">{children}</div>;
}

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
	const workspace = useOptionalQuestWorkspace();
	if (!workspace) return null;
	return <QuestDetailContent questId={questId} fallbackData={fallbackData} fallbackMode={fallbackMode} />;
}

function QuestDetailContent({
	questId,
	fallbackData,
	fallbackMode,
}: {
	questId: string;
	fallbackData?: QuestDetailData | null;
	fallbackMode?: TarkovJsonGameMode;
}) {
	const { questsById } = useQuestWorkspace();
	const details = useQuestDetails([questId], questsById.has(questId), fallbackData, fallbackMode);
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
