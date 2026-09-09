"use client";

import { useQuery } from "@tanstack/react-query";
import { DataLoadError, DataQueryRetryProvider, DataRefreshError } from "@/components/core/DataLoadError";
import { RouteLoader } from "@/components/core/RouteLoader";
import { DeferredPriceBoundary } from "./DeferredPriceBoundary";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled, useUserStoreHydrated } from "@/lib/query/game-data";
import { itemChecklistPageQueryOptions, pageDataFromQuery } from "@/lib/query/page-data";
import { PartialDataError } from "@/lib/query/request";
import type { ItemChecklistPageData } from "@/types/contracts";
import { ItemsClientPage } from "./ItemsClientPage";

export function ItemsQueryPage({ mode, fallbackData }: { mode: TarkovJsonGameMode; fallbackData: ItemChecklistPageData | null }) {
    const hydrated = useUserStoreHydrated();
    const enabled = useGameDataEnabled(mode);
    const query = useQuery({ ...itemChecklistPageQueryOptions(mode), enabled, placeholderData: fallbackData ?? undefined });
    if (hydrated && !enabled) return <RouteLoader page="items" />;
    const data = pageDataFromQuery(query.data, query.error, fallbackData);
    if (!data && query.isPending) return <RouteLoader page="items" />;
    if (!data) return <DataQueryRetryProvider retry={() => void query.refetch()}><main className="container mx-auto px-6 py-8"><DataLoadError title="Item checklist data is unavailable" messages={[query.error?.message ?? "Item checklist data could not be loaded."]} /></main></DataQueryRetryProvider>;
    return <DataQueryRetryProvider retry={() => void query.refetch()}>{query.error && !(query.error instanceof PartialDataError) && <DataRefreshError message="Updated checklist data could not be loaded." />}<DeferredPriceBoundary mode={mode} itemIds={data.itemIds}><ItemsClientPage data={data} dataMode={mode} /></DeferredPriceBoundary></DataQueryRetryProvider>;
}
