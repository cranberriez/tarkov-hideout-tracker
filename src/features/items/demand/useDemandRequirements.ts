"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useKappaStore } from "@/lib/stores/useKappaStore";
import { COLLECTOR_QUEST_ID_BY_MODE } from "@/lib/quests/collector";
import { fetchJson } from "@/lib/query/request";
import { gameDataKey, useGameDataEnabled } from "@/lib/query/game-data";
import type { UploaderSummaryData } from "@/types/uploader";
import type { KappaDemand } from "./item-demand-model";

/** Requirement metadata and profile progress that `buildItemDemand` reads. */
export function useDemandRequirements() {
	const profile = useUserStore(
		useShallow((state) => ({
			gameMode: state.gameMode,
			stationLevels: state.stationLevels,
			stationGoals: state.stationGoals,
			completedRequirements: state.completedRequirements,
			completedQuests: state.completedQuests,
			completedQuestObjectives: state.completedQuestObjectives,
			failedQuests: state.failedQuests,
			ignoredQuests: state.ignoredQuests,
			playerLevel: state.playerLevel,
			prestigeLevel: state.prestigeLevel,
			questFaction: state.questFaction,
			questTraderLoyaltyLevels: state.questTraderLoyaltyLevels,
			questFenceReputation: state.questFenceReputation,
		})),
	);
	const kappaCompleted = useKappaStore((state) => state.completedItemsByMode[profile.gameMode]);
	const kappaIgnored = useKappaStore((state) => state.ignoreInUploader);
	const mode = toTarkovJsonGameMode(profile.gameMode);
	const enabled = useGameDataEnabled(mode);
	const query = useQuery({
		queryKey: gameDataKey(mode, "uploader-requirements"),
		queryFn: ({ signal }) => fetchJson<UploaderSummaryData>(`/api/page-data/uploader?mode=${mode}`, { signal }),
		enabled,
		staleTime: 5 * 60 * 1000,
		retry: false,
		meta: { retentionGroup: "page-data", inactiveQueryLimit: 12 },
	});
	const kappa = useMemo(
		(): KappaDemand => ({
			questId: COLLECTOR_QUEST_ID_BY_MODE[mode],
			completed: kappaCompleted ?? {},
			ignored: kappaIgnored,
		}),
		[kappaCompleted, kappaIgnored, mode],
	);
	return { mode, profile, kappa, query };
}
