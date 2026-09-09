import { queryOptions } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "../game-mode";
import { PartialDataError, fetchJson, requireComplete } from "./request";
import { gameDataKey } from "./scope";
import type {
    HideoutPageData,
    ItemChecklistPageData,
    KappaChecklistPageData,
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

export function isCompleteQuestWorkspacePageData(data: QuestWorkspacePageData) {
    return Boolean(data.quests && data.items && !data.errors.quests && !data.errors.items);
}

export function isCompleteKappaChecklistPageData(data: KappaChecklistPageData) {
    return Boolean(data.collectorQuest && !data.errors.quests && !data.errors.items);
}

export function isCompleteProfitPageData(data: ProfitPageData) {
    return Boolean(data.items && Object.values(data.errors).every((error) => error === null));
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
        queryFn: async ({ signal }) => requireComplete(
            await fetchJson<T>(path, { signal }),
            complete,
            "Some page data is unavailable.",
        ),
        staleTime: PAGE_DATA_STALE_TIME,
        retry: false,
        meta: { retentionGroup: "page-data", inactiveQueryLimit: 12 },
    });
}

export function hideoutPageQueryOptions(mode: TarkovJsonGameMode) {
    return pageQueryOptions<HideoutPageData>(mode, "hideout-page", `/api/page-data/hideout?mode=${mode}`, isCompleteHideoutPageData);
}

export function itemChecklistPageQueryOptions(mode: TarkovJsonGameMode) {
    return pageQueryOptions<ItemChecklistPageData>(mode, "items-page", `/api/page-data/items?mode=${mode}`, isCompleteItemChecklistPageData);
}

export function questWorkspacePageQueryOptions(mode: TarkovJsonGameMode, devQuery: string | null = null) {
    const params = new URLSearchParams({ mode });
    if (devQuery) params.set("q", devQuery);
    return pageQueryOptions<QuestWorkspacePageData>(mode, "quests-page", `/api/page-data/quests?${params}`, isCompleteQuestWorkspacePageData, [devQuery]);
}

export function kappaChecklistPageQueryOptions(mode: TarkovJsonGameMode) {
    return pageQueryOptions<KappaChecklistPageData>(mode, "kappa-page", `/api/page-data/kappa?mode=${mode}`, isCompleteKappaChecklistPageData);
}

export function profitPageQueryOptions(mode: TarkovJsonGameMode) {
    return pageQueryOptions<ProfitPageData>(mode, "recipes-crafts-barters", `/api/page-data/profit?mode=${mode}&prices=none`, isCompleteProfitPageData, ["unpriced-v1"]);
}

export function pageDataFromQuery<T>(data: T | undefined, error: Error | null, fallbackData: T | null): T | null {
    return error instanceof PartialDataError ? error.payload as T : data ?? fallbackData;
}
