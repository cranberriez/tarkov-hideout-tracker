"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled } from "@/lib/query/game-data";
import { questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { expandQuestSummaries } from "@/lib/quests/quest-summary-payload";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { QuestWorkspaceQuest } from "@/types/quests";
import { useQuestDetails } from "../../../quests/useQuestDetails";
import { getQuestWorkspaceStatus } from "../../../quests/workspace/quest-workspace-utils";
import { isQuestOnMap } from "../../../quests/quest-map-match";
import { buildQuestMarkers } from "./quest-map-markers";

/**
 * The active profile's active quests on this map (not ignored), worked out from the shared quest index, and
 * their objective markers. Full details load only for those quests.
 */
export function useMapQuests(mode: TarkovJsonGameMode, mapKey: string) {
	const enabled = useGameDataEnabled(mode);
	const index = useQuery({ ...questWorkspacePageQueryOptions(mode), enabled });
	const profile = useUserStore(
		useShallow((state) => ({
			playerLevel: state.playerLevel,
			prestigeLevel: state.prestigeLevel,
			faction: state.questFaction,
			traderLoyaltyLevels: state.questTraderLoyaltyLevels,
			fenceReputation: state.questFenceReputation,
			completedQuests: state.completedQuests,
			failedQuests: state.failedQuests,
		})),
	);
	const ignored = useUserStore((state) => state.ignoredQuests);
	const visited = useUserStore((state) => state.completedQuestObjectives);

	const summaries = index.data?.quests;
	const active = useMemo(() => {
		if (!summaries) return [];
		const quests = expandQuestSummaries(summaries);
		const byId = new Map<string, QuestWorkspaceQuest>(quests.map((quest) => [quest.id, quest]));
		return quests.filter(
			(quest) =>
				!ignored[quest.id] &&
				isQuestOnMap(quest, mapKey) &&
				getQuestWorkspaceStatus(quest, profile, byId).status === "active",
		);
	}, [summaries, ignored, mapKey, profile]);

	const details = useQuestDetails(
		active.map((quest) => quest.id),
		active.length > 0,
	);
	const markers = useMemo(() => buildQuestMarkers(details.quests, mapKey, visited), [details.quests, mapKey, visited]);

	return {
		/** Active quest summaries tied to this map, in prerequisite order. */
		active,
		/** Loaded full records, by id. */
		detailsById: useMemo(() => new Map(details.quests.map((quest) => [quest.id, quest])), [details.quests]),
		items: details.items,
		markers,
		pending: (enabled && index.isPending) || details.pending,
		error: index.error?.message ?? index.data?.error ?? details.error,
		retry: () => {
			void index.refetch();
			details.retry();
		},
	};
}
