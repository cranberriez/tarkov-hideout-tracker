"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataLoadError, DataQueryRetryProvider, DataRefreshError } from "@/components/core/DataLoadError";
import { RouteLoader } from "@/components/core/RouteLoader";
import { DeferredPriceBoundary } from "@/features/items/DeferredPriceBoundary";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled, useUserStoreHydrated } from "@/lib/query/game-data";
import { hideoutPageQueryOptions, pageDataFromQuery } from "@/lib/query/page-data";
import { PartialDataError } from "@/lib/query/request";
import type { HideoutPageData } from "@/types/contracts";
import { StationDetailsPage } from "./StationDetailsPage";

/** Station pages share the Hideout page query; only the viewed station's items are priced. */
export function StationDetailQueryPage({ mode, stationId, fallbackData }: { mode: TarkovJsonGameMode; stationId: string; fallbackData: HideoutPageData | null }) {
    const hydrated = useUserStoreHydrated();
    const enabled = useGameDataEnabled(mode);
    const query = useQuery({ ...hideoutPageQueryOptions(mode), enabled, placeholderData: fallbackData ?? undefined });
    const data = pageDataFromQuery(query.data, query.error, fallbackData);
    const station = data?.stations?.find((entry) => entry.id === stationId) ?? null;
    const itemIds = useMemo(
        () => [...new Set(station?.levels.flatMap((level) => level.itemRequirements.map((requirement) => requirement.itemId)) ?? [])],
        [station],
    );
    if (hydrated && !enabled) return <RouteLoader page="hideout" title="Station" />;
    if (!data && query.isPending) return <RouteLoader page="hideout" title="Station" />;
    if (!data?.stations || !station) {
        return (
            <DataQueryRetryProvider retry={() => void query.refetch()}>
                <main className="container mx-auto px-6 py-8">
                    <DataLoadError
                        title="Station data is unavailable"
                        messages={[data?.errors.stations ?? (data?.stations ? "This station is not part of the current game mode's hideout data." : query.error?.message ?? "Hideout data could not be loaded.")]}
                    />
                </main>
            </DataQueryRetryProvider>
        );
    }
    return (
        <DataQueryRetryProvider retry={() => void query.refetch()}>
            {data.errors.items
                ? <DataRefreshError message={data.errors.items} />
                : query.error && !(query.error instanceof PartialDataError) && <DataRefreshError message="Updated hideout data could not be loaded." />}
            <DeferredPriceBoundary mode={mode} itemIds={itemIds}>
                <StationDetailsPage station={station} data={data} mode={mode} />
            </DeferredPriceBoundary>
        </DataQueryRetryProvider>
    );
}
