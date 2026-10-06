import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { ItemsQueryPage } from "@/features/items/ItemsQueryPage";
import {
	isCompleteItemChecklistPageData,
	itemChecklistPageQueryOptions,
	PAGE_DATA_STALE_TIME,
} from "@/lib/query/page-data";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getItemChecklistPageData } from "@/server/queries/getItemChecklistPageData";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

export const metadata: Metadata = {
	title: "Hideout & Quest Item Checklist",
	description: "Track the items you need for Escape from Tarkov hideout upgrades and quest hand-ins, including Found in Raid requirements and remaining quantities.",
	alternates: { canonical: "/items" },
};

export default async function ItemsPage() {
	const gameMode = await getActiveTarkovJsonGameMode();
	const options = itemChecklistPageQueryOptions(gameMode);
	const { state, fallbackData } = await prefetchPageData(
		options.queryKey,
		PAGE_DATA_STALE_TIME,
		async () => getItemChecklistPageData(gameMode, await getCurrentPageRepository(gameMode), { includePrices: false }),
		isCompleteItemChecklistPageData,
	);

	return (
		<HydrationBoundary state={state}>
			<ItemsQueryPage mode={gameMode} fallbackData={fallbackData} />
		</HydrationBoundary>
	);
}
