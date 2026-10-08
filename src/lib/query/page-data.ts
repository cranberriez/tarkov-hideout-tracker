import { queryOptions } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "../game-mode";
import { PartialDataError, fetchJson, requireComplete } from "./request";
import { gameDataKey } from "./scope";
import type { QuestWorkspaceIndexData } from "../../types/quest-workspace";
import type {
	HideoutPageData,
	HigherLowerPageData,
	ItemChecklistPageData,
	KappaChecklistPageData,
	MarketPageData,
	ProfitPageData,
	QuestWorkspacePageData,
} from "../../types/contracts";

export const PAGE_DATA_STALE_TIME = 5 * 60 * 1000;

export function isCompleteHideoutPageData(data: HideoutPageData) {
	return Boolean(data.stations && data.items && !data.errors.stations && !data.errors.items);
}

export function isCompleteItemChecklistPageData(data: ItemChecklistPageData) {
	return Boolean(data.stations && data.items && !data.errors.stations && !data.errors.items && !data.errors.quests);
}

export function isCompleteQuestWorkspacePageData(
	data: Pick<QuestWorkspacePageData, "items" | "errors"> & { quests: readonly unknown[] | null },
) {
	return Boolean(data.quests && data.items && !data.errors.quests && !data.errors.items);
}

export function isCompleteKappaChecklistPageData(data: KappaChecklistPageData) {
	return Boolean(data.collectorQuest && !data.errors.quests && !data.errors.items);
}

export function isCompleteProfitPageData(data: ProfitPageData) {
	return Boolean(data.items && Object.values(data.errors).every((error) => error === null));
}

/** Malformed rows are left out and reported, so only a missing analytics schema is incomplete. */
export function isCompleteMarketPageData(data: MarketPageData) {
	return data.error === null && data.invalidCount === 0;
}

function pageQueryOptions<T>(
	mode: TarkovJsonGameMode,
	domain: string,
	path: string,
	complete: (data: T) => boolean,
	parts: readonly unknown[] = [],
) {
	return queryOptions({
		queryKey: gameDataKey(mode, domain, ...parts),
		queryFn: async ({ signal }) =>
			requireComplete(await fetchJson<T>(path, { signal }), complete, "Some page data is unavailable."),
		staleTime: PAGE_DATA_STALE_TIME,
		retry: false,
		meta: { retentionGroup: "page-data", inactiveQueryLimit: 12 },
	});
}

export function hideoutPageQueryOptions(mode: TarkovJsonGameMode) {
	return pageQueryOptions<HideoutPageData>(
		mode,
		"hideout-page",
		`/api/page-data/hideout?mode=${mode}`,
		isCompleteHideoutPageData,
	);
}

export function stationDetailQueryOptions(mode: TarkovJsonGameMode, stationId: string) {
	return pageQueryOptions<HideoutPageData>(
		mode,
		"station-detail",
		`/api/page-data/station?${new URLSearchParams({ mode, stationId })}`,
		isCompleteHideoutPageData,
		[stationId],
	);
}

export function stationRecipeQueryOptions(mode: TarkovJsonGameMode, stationId: string) {
	return pageQueryOptions<ProfitPageData>(
		mode,
		"station-recipes",
		`/api/page-data/station?${new URLSearchParams({ mode, stationId, view: "recipes" })}`,
		isCompleteProfitPageData,
		[stationId],
	);
}

export function itemChecklistPageQueryOptions(mode: TarkovJsonGameMode) {
	return pageQueryOptions<ItemChecklistPageData>(
		mode,
		"items-page",
		`/api/page-data/items?mode=${mode}`,
		isCompleteItemChecklistPageData,
	);
}

export function questWorkspacePageQueryOptions(mode: TarkovJsonGameMode, devQuery: string | null = null) {
	const params = new URLSearchParams({ mode, format: "index-v1" });
	if (devQuery) params.set("q", devQuery);
	return pageQueryOptions<QuestWorkspaceIndexData>(
		mode,
		"quests-page",
		`/api/page-data/quests?${params}`,
		isCompleteQuestWorkspaceIndex,
		[devQuery, "index-v1"],
	);
}

export function isCompleteQuestWorkspaceIndex(data: QuestWorkspaceIndexData) {
	return data.quests !== null && !data.error;
}

export function kappaChecklistPageQueryOptions(mode: TarkovJsonGameMode) {
	return pageQueryOptions<KappaChecklistPageData>(
		mode,
		"kappa-page",
		`/api/page-data/kappa?mode=${mode}`,
		isCompleteKappaChecklistPageData,
	);
}

export function profitPageQueryOptions(mode: TarkovJsonGameMode) {
	return pageQueryOptions<ProfitPageData>(
		mode,
		"recipes-crafts-barters",
		`/api/page-data/profit?mode=${mode}&prices=none`,
		isCompleteProfitPageData,
		["unpriced-v1"],
	);
}

/** The market page renders its explicit partial states itself, so the payload is never rejected. */
export function marketPageQueryOptions(mode: TarkovJsonGameMode) {
	return queryOptions({
		queryKey: gameDataKey(mode, "market-page"),
		queryFn: ({ signal }) => fetchJson<MarketPageData>(`/api/page-data/market?mode=${mode}`, { signal }),
		staleTime: PAGE_DATA_STALE_TIME,
		meta: { retentionGroup: "page-data", inactiveQueryLimit: 12 },
	});
}

/** Like the market page, the game renders a missing analytics schema itself. */
export function higherLowerQueryOptions(mode: TarkovJsonGameMode) {
	return queryOptions({
		queryKey: gameDataKey(mode, "higher-lower"),
		queryFn: ({ signal }) =>
			fetchJson<HigherLowerPageData>(`/api/page-data/games/higher-lower?mode=${mode}`, { signal }),
		staleTime: PAGE_DATA_STALE_TIME,
		meta: { retentionGroup: "page-data", inactiveQueryLimit: 12 },
	});
}

export function pageDataFromQuery<T>(data: T | undefined, error: Error | null, fallbackData: T | null): T | null {
	return error instanceof PartialDataError ? (error.payload as T) : (data ?? fallbackData);
}
