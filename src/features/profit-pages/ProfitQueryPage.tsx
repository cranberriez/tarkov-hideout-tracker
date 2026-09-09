"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useItemPrices } from "@/features/items/useItemPrices";
import { DataLoadError, DataQueryRetryProvider, DataRefreshError } from "@/components/core/DataLoadError";
import { RouteLoader } from "@/components/core/RouteLoader";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled, useUserStoreHydrated } from "@/lib/query/game-data";
import { pageDataFromQuery, profitPageQueryOptions } from "@/lib/query/page-data";
import { PartialDataError } from "@/lib/query/request";
import type { ProfitPageData } from "@/types/contracts";
import { CraftPlannerClient } from "./optimize/CraftPlannerClient";
import { ProfitPageClient } from "./ProfitPageClient";
import type { ProfitPageKind } from "./types";

function useProfitPageData(mode: TarkovJsonGameMode, fallbackData: ProfitPageData | null) {
    const hydrated = useUserStoreHydrated();
    const enabled = useGameDataEnabled(mode);
    const query = useQuery({ ...profitPageQueryOptions(mode), enabled, placeholderData: fallbackData ?? undefined });
    const rawData = pageDataFromQuery(query.data, query.error, fallbackData);
    const priceIds = useMemo(() => rawData?.itemIds ?? [], [rawData]);
    const prices = useItemPrices(mode, priceIds, "recipes");
    const data = useMemo(() => rawData ? {
        ...rawData,
        items: rawData.items?.map((item) => ({ ...item, marketPrice: prices.prices[item.id] ?? null })) ?? null,
        errors: { ...rawData.errors, prices: Object.values(prices.states).some((state) => state !== "ready")
            ? "Recipe prices are not available yet." : null },
    } : null, [rawData, prices.prices, prices.states]);
    return { hydrated, enabled, query, data, prices };
}

export function ProfitQueryPage({ mode, kind, initialTargetRecipeId, fallbackData }: { mode: TarkovJsonGameMode; kind: ProfitPageKind; initialTargetRecipeId?: string; fallbackData: ProfitPageData | null }) {
    const { hydrated, enabled, query, data, prices } = useProfitPageData(mode, fallbackData);
    if (hydrated && !enabled) return <RouteLoader page="items" />;
    if (!data && query.isPending) return <RouteLoader page="items" />;
    if (data && prices.state === "pending") return <RouteLoader page="items" title="Loading recipe prices" />;
    if (!data) return <DataQueryRetryProvider retry={() => void query.refetch()}><main className="container mx-auto px-6 py-8"><DataLoadError title="Profit data is unavailable" messages={[query.error?.message ?? "Profit data could not be loaded."]} /></main></DataQueryRetryProvider>;
    return <DataQueryRetryProvider retry={() => void query.refetch()}>{query.error && !(query.error instanceof PartialDataError) && <DataRefreshError message="Updated profit data could not be loaded." />}<ProfitPageClient kind={kind} data={data} initialTargetRecipeId={initialTargetRecipeId} /></DataQueryRetryProvider>;
}

export function CraftPlannerQueryPage({ mode, fallbackData }: { mode: TarkovJsonGameMode; fallbackData: ProfitPageData | null }) {
    const { hydrated, enabled, query, data, prices } = useProfitPageData(mode, fallbackData);
    if (hydrated && !enabled) return <RouteLoader page="hideout" />;
    if (!data && query.isPending) return <RouteLoader page="hideout" />;
    if (data && prices.state === "pending") return <RouteLoader page="hideout" title="Loading recipe prices" />;
    if (!data) return <DataQueryRetryProvider retry={() => void query.refetch()}><main className="container mx-auto px-6 py-8"><DataLoadError title="Craft planner data is unavailable" messages={[query.error?.message ?? "Craft planner data could not be loaded."]} /></main></DataQueryRetryProvider>;
    return <DataQueryRetryProvider retry={() => void query.refetch()}>{query.error && !(query.error instanceof PartialDataError) && <DataRefreshError message="Updated craft-planner data could not be loaded." />}<CraftPlannerClient data={data} /></DataQueryRetryProvider>;
}
