"use client";

import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { itemRelationsQueryOptions } from "@/features/items/item-detail/item-detail-queries";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled } from "@/lib/query/game-data";
import { useUserStore } from "@/lib/stores/useUserStore";
import { deriveItemPreviewDemand } from "./item-preview-demand";
import { PreviewFact } from "./entity-preview";

/** Mounted only while the preview is visible; uses the same scoped relations cache as the dialog. */
export function ItemPreviewNeeds({ itemId }: { itemId: string }) {
	const state = useUserStore(
		useShallow((state) => ({
			gameMode: state.gameMode,
			stationLevels: state.stationLevels,
			completedRequirements: state.completedRequirements,
			itemCounts: state.itemCounts,
			completedQuests: state.completedQuests,
			failedQuests: state.failedQuests,
			ignoredQuests: state.ignoredQuests,
			pinnedQuests: state.pinnedQuests,
			playerLevel: state.playerLevel,
			prestigeLevel: state.prestigeLevel,
			faction: state.questFaction,
			traderLoyaltyLevels: state.questTraderLoyaltyLevels,
			fenceReputation: state.questFenceReputation,
			visibilityMode: state.itemQuestVisibilityMode,
			customLookahead: state.itemQuestCustomLookahead,
			customLevelLookahead: state.itemQuestCustomLevelLookahead,
			showFutureFir: state.itemShowFutureFir,
			showIgnored: state.itemShowIgnored,
		})),
	);
	const mode = toTarkovJsonGameMode(state.gameMode);
	const enabled = useGameDataEnabled(mode);
	const request = useQuery({ ...itemRelationsQueryOptions(mode, itemId), enabled });
	const needs = request.data ? deriveItemPreviewDemand(itemId, request.data, state, state) : null;
	if (request.isError || (request.data && !needs))
		return (
			<PreviewFact label="Demand">
				<span className="text-muted-foreground">Unavailable</span>
			</PreviewFact>
		);
	if (!needs)
		return (
			<PreviewFact label="Demand">
				<span className="text-muted-foreground">Loading…</span>
			</PreviewFact>
		);
	if (needs.totalRequiredCount === 0) return null;
	return (
		<>
			{needs.questRequiredCount > 0 && (
				<PreviewFact
					label={
						<span title="Remaining quests matching your Items filters; alternative-item objectives are excluded.">
							Keep for Quests
						</span>
					}
				>
					<span className="font-mono">{needs.questRequiredCount}</span>
					{needs.questRequiredFirCount > 0 && (
						<span className="ml-1 text-fir">· {needs.questRequiredFirCount} FiR</span>
					)}
				</PreviewFact>
			)}
			{needs.hideoutRequiredCount > 0 && (
				<PreviewFact label={<span title="Remaining uncompleted hideout upgrade requirements.">Keep for Hideout</span>}>
					<span className="font-mono">{needs.hideoutRequiredCount}</span>
					{needs.hideoutRequiredFirCount > 0 && (
						<span className="ml-1 text-fir">· {needs.hideoutRequiredFirCount} FiR</span>
					)}
				</PreviewFact>
			)}
		</>
	);
}
