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
import type { ItemSummary } from "@/types/items";
import type { ReviewEntry } from "./review-model";
import { buildUploaderSummary, type KappaDemand } from "./summary-model";
import { unitSellValue } from "./decision-model";
import { inventoryBeforeSends, type SentCounts } from "./inventory-model";
import { useItemPrices } from "../items/useItemPrices";

export function useUploaderSummary(
	entries: readonly ReviewEntry[],
	items: readonly ItemSummary[],
	sent: SentCounts,
	/** Items this scan already checked off on the Kappa checklist. */
	kappaSent: readonly string[],
) {
	const profile = useUserStore(
		useShallow((state) => ({
			gameMode: state.gameMode,
			stationLevels: state.stationLevels,
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
	const counts = useUserStore((state) => state.itemCounts);
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
	const priceIds = useMemo(() => entries.flatMap((entry) => (entry.itemId ? [entry.itemId] : [])), [entries]);
	const prices = useItemPrices(mode, priceIds);
	// This scan's own sends must not turn its kept copies into surplus.
	const owned = useMemo(() => inventoryBeforeSends(counts, sent), [counts, sent]);
	// Like inventory, this scan's own check-offs must not release the copies they reserved.
	const kappa = useMemo((): KappaDemand => {
		const completed = { ...kappaCompleted };
		for (const itemId of kappaSent) delete completed[itemId];
		return { questId: COLLECTOR_QUEST_ID_BY_MODE[mode], completed, ignored: kappaIgnored };
	}, [kappaCompleted, kappaSent, kappaIgnored, mode]);
	const summary = useMemo(
		() =>
			query.data
				? buildUploaderSummary(
						entries,
						items,
						query.data,
						profile,
						owned,
						(id) => unitSellValue(prices.prices[id]),
						kappa,
					)
				: null,
		[entries, items, query.data, profile, owned, prices.prices, kappa],
	);
	return { summary, prices, error: query.error, retry: query.refetch, loading: query.isFetching };
}
