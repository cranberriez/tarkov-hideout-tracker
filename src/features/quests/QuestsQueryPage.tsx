"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DataLoadError, DataQueryRetryProvider, DataRefreshError } from "@/components/core/DataLoadError";
import { RouteLoader } from "@/components/core/RouteLoader";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled, useUserStoreHydrated } from "@/lib/query/game-data";
import { pageDataFromQuery, questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { expandQuestSummaries } from "@/lib/quests/quest-summary-payload";
import type { QuestWorkspaceIndexData } from "@/types/quest-workspace";
import { QuestsClientPage } from "./QuestsClientPage";
import { useDevQuestQuery } from "./useDevQuestQuery";

export function QuestsQueryPage({
	mode,
	fallbackData,
	children,
}: {
	mode: TarkovJsonGameMode;
	fallbackData: QuestWorkspaceIndexData | null;
	children: ReactNode;
}) {
	const devQuery = useDevQuestQuery();
	const hydrated = useUserStoreHydrated();
	const enabled = useGameDataEnabled(mode);
	const query = useQuery({
		...questWorkspacePageQueryOptions(mode, devQuery),
		enabled,
		placeholderData: devQuery ? undefined : (fallbackData ?? undefined),
	});
	if (hydrated && !enabled) return <RouteLoader page="quests" />;
	const data = pageDataFromQuery(query.data, query.error, fallbackData);
	if ((!data && query.isPending) || (query.isPlaceholderData && query.isFetching)) return <RouteLoader page="quests" />;
	if (!data?.quests)
		return (
			<DataQueryRetryProvider retry={() => void query.refetch()}>
				<main className="container mx-auto px-6 py-8">
					<DataLoadError
						title="Quest index is unavailable"
						messages={[data?.error ?? query.error?.message ?? "Quest index could not be loaded."]}
					/>
				</main>
			</DataQueryRetryProvider>
		);
	return (
		<DataQueryRetryProvider retry={() => void query.refetch()}>
			{query.error && <DataRefreshError message="Updated quest index could not be loaded." />}
			<QuestsClientPage quests={expandQuestSummaries(data.quests)} devQuery={devQuery}>
				{children}
			</QuestsClientPage>
		</DataQueryRetryProvider>
	);
}
