import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import { StationCraftsSkeleton } from "@/features/hideout/details/crafts/StationCraftsSkeleton";
import { prefetchStationCrafts, StationCraftsStream } from "@/features/hideout/details/crafts/StationCraftsStream";
import { StationDetailQueryPage } from "@/features/hideout/details/StationDetailQueryPage";
import { STATIC_STATIONS } from "@/lib/data/static-stations";
import { stationPath } from "@/lib/entity-routes";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { stationDetailQueryOptions, isCompleteHideoutPageData, PAGE_DATA_STALE_TIME } from "@/lib/query/page-data";
import { decodeRouteParam } from "@/lib/utils/route-param";
import { modeCanonical, readRouteGameMode } from "@/server/route-game-mode";
import { getHideoutPageData } from "@/server/queries/getHideoutPageData";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

interface StationPageProps {
	params: Promise<{ mode: string; stationId: string }>;
}

/** The static station list is small; stations missing from a mode prerender their 404. */
export function generateStaticParams() {
	return STATIC_STATIONS.map((station) => ({ stationId: station.id }));
}

/** Metadata and the page share one request-scoped Hideout read. */
const loadHideout = cache(async (gameMode: TarkovJsonGameMode, stationId: string) => {
	const load = async () =>
		getHideoutPageData(gameMode, await getCurrentPageRepository(gameMode), { includePrices: false, stationId });
	return { gameMode, data: await load() };
});

export async function generateMetadata({ params }: StationPageProps): Promise<Metadata> {
	const { gameMode, dataMode } = await readRouteGameMode(params);
	const stationId = decodeRouteParam((await params).stationId);
	const station = (await loadHideout(dataMode, stationId)).data.stations?.find((entry) => entry.id === stationId);
	if (!station) return { title: "Hideout station unavailable", robots: { index: false, follow: true } };
	return {
		title: `${station.name} (Hideout)`,
		description: `Escape from Tarkov ${station.name}: requirements for all ${station.levels.length} levels, station dependencies, construction times, and crafts.`,
		alternates: modeCanonical(gameMode, stationPath(station.id)),
	};
}

export default async function StationPage({ params }: StationPageProps) {
	const { dataMode: activeMode } = await readRouteGameMode(params);
	const stationId = decodeRouteParam((await params).stationId);
	// Starts before the Hideout await so the recipe read overlaps it; resolved by the Suspense slot.
	const craftsPrefetch = prefetchStationCrafts(activeMode, stationId);
	const { gameMode, data } = await loadHideout(activeMode, stationId);
	// Missing stations 404 only when the station list itself loaded.
	if (data.stations && !data.stations.some((entry) => entry.id === stationId)) notFound();
	const options = stationDetailQueryOptions(gameMode, stationId);
	const { state, fallbackData } = await prefetchPageData(
		options.queryKey,
		PAGE_DATA_STALE_TIME,
		async () => data,
		isCompleteHideoutPageData,
	);

	return (
		<HydrationBoundary state={state}>
			<StationDetailQueryPage
				mode={gameMode}
				stationId={stationId}
				fallbackData={fallbackData}
				crafts={
					<Suspense fallback={<StationCraftsSkeleton />}>
						<StationCraftsStream mode={activeMode} prefetch={craftsPrefetch} />
					</Suspense>
				}
			/>
		</HydrationBoundary>
	);
}
