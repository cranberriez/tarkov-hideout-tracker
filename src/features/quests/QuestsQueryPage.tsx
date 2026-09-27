"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { DataLoadError, DataQueryRetryProvider, DataRefreshError } from "@/components/core/DataLoadError";
import { DataNotice } from "@/components/ui/data-notice";
import { RouteLoader } from "@/components/core/RouteLoader";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled, useUserStoreHydrated } from "@/lib/query/game-data";
import { pageDataFromQuery, questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { PartialDataError } from "@/lib/query/request";
import type { QuestWorkspacePageData } from "@/types/contracts";
import { QuestsClientPage } from "./QuestsClientPage";
import { DEV_QUEST_QUERY } from "./dev-quest-fixture";

export function QuestsQueryPage({ mode, fallbackData, children }: { mode: TarkovJsonGameMode; fallbackData: QuestWorkspacePageData | null; children: ReactNode }) {
    const searchParams = useSearchParams();
    // The development fixture is opt-in per URL and fetched client-side; it never enters the server prefetch.
    const devQuery = process.env.NODE_ENV === "development" && searchParams.get("q") === DEV_QUEST_QUERY ? DEV_QUEST_QUERY : null;
    const hydrated = useUserStoreHydrated();
    const enabled = useGameDataEnabled(mode);
    const query = useQuery({ ...questWorkspacePageQueryOptions(mode, devQuery), enabled, placeholderData: devQuery ? undefined : fallbackData ?? undefined });
    if (hydrated && !enabled) return <RouteLoader page="quests" />;
    const data = pageDataFromQuery(query.data, query.error, fallbackData);
    if (!data && query.isPending) return <RouteLoader page="quests" />;
    if (!data?.quests) return <DataQueryRetryProvider retry={() => void query.refetch()}><main className="container mx-auto px-6 py-8"><DataLoadError title="Quest workspace data is unavailable" messages={[data?.errors.quests ?? query.error?.message ?? "Quest workspace data could not be loaded."]} /></main></DataQueryRetryProvider>;
    return <DataQueryRetryProvider retry={() => void query.refetch()}>
        {data.errors.items
            ? <DataRefreshError message={data.errors.items} />
            : query.error && !(query.error instanceof PartialDataError) && <DataRefreshError message="Updated quest data could not be loaded." />}
        {data.unresolvedItemIds.length > 0 && (
            <DataNotice className="mx-auto mb-4 max-w-5xl">
                {data.unresolvedItemIds.length} referenced item{data.unresolvedItemIds.length === 1 ? " is" : "s are"} unavailable. Affected requirements remain unresolved.
            </DataNotice>
        )}
        <QuestsClientPage quests={data.quests} items={data.items} devQuery={devQuery}>{children}</QuestsClientPage>
    </DataQueryRetryProvider>;
}
