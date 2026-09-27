import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import { StationDetailQueryPage } from "@/features/hideout/StationDetailQueryPage";
import { stationHref } from "@/lib/entity-routes";
import { hideoutPageQueryOptions, isCompleteHideoutPageData, PAGE_DATA_STALE_TIME } from "@/lib/query/page-data";
import { decodeRouteParam } from "@/lib/utils/route-param";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getHideoutPageData } from "@/server/queries/getHideoutPageData";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

interface StationPageProps {
	params: Promise<{ stationId: string }>;
}

/** Metadata and the page share one request-scoped Hideout read. */
const loadHideout = cache(async () => {
	const gameMode = await getActiveTarkovJsonGameMode();
	const load = async () => getHideoutPageData(gameMode, await getCurrentPageRepository(gameMode), { includePrices: false });
	return { gameMode, data: await load() };
});

export async function generateMetadata({ params }: StationPageProps): Promise<Metadata> {
	const stationId = decodeRouteParam((await params).stationId);
	const station = (await loadHideout()).data.stations?.find((entry) => entry.id === stationId);
	if (!station) return { title: "Hideout station" };
	return {
		title: `${station.name} (Hideout)`,
		description: `Escape from Tarkov ${station.name}: requirements for all ${station.levels.length} levels, station dependencies, construction times, and crafts.`,
		alternates: { canonical: stationHref(station.id) },
	};
}

export default async function StationPage({ params }: StationPageProps) {
	const stationId = decodeRouteParam((await params).stationId);
	const { gameMode, data } = await loadHideout();
	// Missing stations 404 only when the station list itself loaded.
	if (data.stations && !data.stations.some((entry) => entry.id === stationId)) notFound();
	const options = hideoutPageQueryOptions(gameMode);
	const { state, fallbackData } = await prefetchPageData(options.queryKey, PAGE_DATA_STALE_TIME, async () => data, isCompleteHideoutPageData);

	return (
		<HydrationBoundary state={state}>
			<StationDetailQueryPage mode={gameMode} stationId={stationId} fallbackData={fallbackData} />
		</HydrationBoundary>
	);
}
