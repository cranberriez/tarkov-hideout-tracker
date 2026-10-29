"use client";

import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useGameDataEnabled, useUserStoreHydrated } from "@/lib/query/game-data";
import { questDetailQueryOptions, type QuestDetailData } from "@/lib/query/quest-details";
import { PartialDataError } from "@/lib/query/request";
import { isDev } from "@/lib/is-dev";
import { DEV_QUEST_QUERY } from "./dev-quest-fixture";

// TanStack structurally shares the combined arrays so map/model derivations remain stable.
function combineDetails(results: UseQueryResult<QuestDetailData, Error>[]) {
	const data = results.map((result) =>
		result.error instanceof PartialDataError ? (result.error.payload as QuestDetailData) : result.data,
	);
	return {
		quests: data.flatMap((entry) => entry?.quest ?? []),
		items: [...new Map(data.flatMap((entry) => entry?.items ?? []).map((item) => [item.id, item])).values()],
		unresolvedItemIds: [...new Set(data.flatMap((entry) => entry?.unresolvedItemIds ?? []))],
		missingIndices: data.flatMap((entry, index) => (entry && !entry.quest && !entry.error ? [index] : [])),
		pending: results.some((result) => result.isPending),
		error:
			results.find((result) => result.error)?.error?.message ??
			data.find((entry) => entry?.error)?.error ??
			data.find((entry) => entry?.itemsError)?.itemsError ??
			null,
		retry: () => {
			for (const result of results) void result.refetch();
		},
	};
}

export function useQuestDetails(
	ids: readonly string[],
	enabled = true,
	fallback?: QuestDetailData | null,
	fallbackMode?: TarkovJsonGameMode,
) {
	const activeMode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	const hydrated = useUserStoreHydrated();
	// SSR and the first hydration render use the route's dataset, before the saved
	// profile is available. Afterwards only the active profile may supply details.
	const mode = !hydrated && fallbackMode ? fallbackMode : activeMode;
	const scopedFallback = fallbackMode && fallbackMode !== mode ? null : fallback;
	const gameEnabled = useGameDataEnabled(mode);
	const searchParams = useSearchParams();
	const devQuery = isDev && searchParams.get("q") === DEV_QUEST_QUERY ? DEV_QUEST_QUERY : null;
	const uniqueIds = [...new Set(ids)].sort();
	const result = useQueries({
		queries: uniqueIds.map((id) => ({
			...questDetailQueryOptions(mode, id, devQuery),
			enabled: enabled && gameEnabled,
			placeholderData:
				uniqueIds.length === 1 && scopedFallback && (!scopedFallback.quest || scopedFallback.quest.id === id)
					? scopedFallback
					: undefined,
		})),
		combine: combineDetails,
	});
	return { ...result, missingQuestIds: result.missingIndices.map((index) => uniqueIds[index]) };
}
