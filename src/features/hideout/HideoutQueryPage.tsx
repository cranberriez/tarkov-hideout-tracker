"use client";

import { useQuery } from "@tanstack/react-query";
import { DataLoadError, DataQueryRetryProvider, DataRefreshError } from "@/components/core/DataLoadError";
import { RouteLoader } from "@/components/core/RouteLoader";
import { DeferredPriceBoundary } from "@/features/items/DeferredPriceBoundary";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled, useUserStoreHydrated } from "@/lib/query/game-data";
import { hideoutPageQueryOptions, pageDataFromQuery } from "@/lib/query/page-data";
import { PartialDataError } from "@/lib/query/request";
import type { HideoutPageData } from "@/types/contracts";
import { HideoutClientPage } from "./HideoutClientPage";

export function HideoutQueryPage({ mode, fallbackData }: { mode: TarkovJsonGameMode; fallbackData: HideoutPageData | null }) {
    const hydrated = useUserStoreHydrated();
    const enabled = useGameDataEnabled(mode);
    const query = useQuery({ ...hideoutPageQueryOptions(mode), enabled, placeholderData: fallbackData ?? undefined });
    if (hydrated && !enabled) return <RouteLoader page="hideout" />;
    const data = pageDataFromQuery(query.data, query.error, fallbackData);
    if (!data && query.isPending) return <RouteLoader page="hideout" />;
    if (!data) return <DataQueryRetryProvider retry={() => void query.refetch()}><main className="container mx-auto px-6 py-8"><DataLoadError title="Hideout data is unavailable" messages={[query.error?.message ?? "Hideout data could not be loaded."]} /></main></DataQueryRetryProvider>;
    return <DataQueryRetryProvider retry={() => void query.refetch()}>{query.error && !(query.error instanceof PartialDataError) && <DataRefreshError message="Updated hideout data could not be loaded." />}<DeferredPriceBoundary mode={mode} itemIds={data.itemIds}><HideoutClientPage data={data} dataMode={mode} /></DeferredPriceBoundary></DataQueryRetryProvider>;
}
