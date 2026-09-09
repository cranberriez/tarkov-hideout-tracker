"use client";

import { useQuery } from "@tanstack/react-query";
import { DataLoadError, DataQueryRetryProvider, DataRefreshError } from "@/components/core/DataLoadError";
import { RouteLoader } from "@/components/core/RouteLoader";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled, useUserStoreHydrated } from "@/lib/query/game-data";
import { pageDataFromQuery, questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { PartialDataError } from "@/lib/query/request";
import type { QuestWorkspacePageData } from "@/types/contracts";
import { QuestsClientPage } from "./QuestsClientPage";

export function QuestsQueryPage({ mode, devQuery, initialQuestId, fallbackData }: { mode: TarkovJsonGameMode; devQuery: string | null; initialQuestId: string | null; fallbackData: QuestWorkspacePageData | null }) {
    const hydrated = useUserStoreHydrated();
    const enabled = useGameDataEnabled(mode);
    const query = useQuery({ ...questWorkspacePageQueryOptions(mode, devQuery), enabled, placeholderData: fallbackData ?? undefined });
    if (hydrated && !enabled) return <RouteLoader page="quests" />;
    const data = pageDataFromQuery(query.data, query.error, fallbackData);
    if (!data && query.isPending) return <RouteLoader page="quests" />;
    if (!data?.quests) return <DataQueryRetryProvider retry={() => void query.refetch()}><main className="container mx-auto px-6 py-8"><DataLoadError title="Quest workspace data is unavailable" messages={[data?.errors.quests ?? query.error?.message ?? "Quest workspace data could not be loaded."]} /></main></DataQueryRetryProvider>;
    return <DataQueryRetryProvider retry={() => void query.refetch()}>
        {data.errors.items
            ? <DataRefreshError message={data.errors.items} />
            : query.error && !(query.error instanceof PartialDataError) && <DataRefreshError message="Updated quest data could not be loaded." />}
        {data.unresolvedItemIds.length > 0 && (
            <div role="status" className="mx-auto mb-4 max-w-5xl rounded border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning">
                {data.unresolvedItemIds.length} referenced item{data.unresolvedItemIds.length === 1 ? " is" : "s are"} unavailable. Affected requirements remain unresolved.
            </div>
        )}
        <QuestsClientPage quests={data.quests} items={data.items} initialQuestId={initialQuestId} />
    </DataQueryRetryProvider>;
}
