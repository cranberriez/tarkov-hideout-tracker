"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Clock } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { DataNotice } from "@/components/ui/data-notice";
import { useDeferredPriceItems } from "@/features/items/DeferredPriceBoundary";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatDuration } from "@/lib/utils/format-time";
import { poolItems } from "@/lib/utils/item-pooling";
import type { HideoutPageData } from "@/types/contracts";
import type { Station } from "@/types/hideout";
import { ExpandedItemRequirements } from "../components/ItemRequirementsExpanded";
import { StationImage } from "../components/StationIdentity";
import { computeStationUpgradeStatus, defaultViewedLevel, getStationLevel } from "../station-model";
import { LevelControls } from "./components/LevelControls";
import { LevelOverview } from "./components/LevelOverview";
import { LevelSummary } from "./components/LevelSummary";
import { PrerequisitesCard } from "./components/PrerequisitesCard";
import { RemainingItemsList } from "./components/RemainingItemsList";
import { RequiredByList } from "./components/RequiredByList";
import { WikiSection } from "./components/WikiSection";
import { StationDetailsProvider, type LevelSelection } from "./StationDetailsContext";
import { buildLevelOverview, remainingStationItems, summarizeRemaining } from "./station-details-model";

/**
 * `/hideout/stations/[stationId]`. The viewed level is local page state; saved levels
 * change only through LevelControls. `crafts` is a server-streamed slot that reads
 * the selection through StationDetailsContext.
 */
export function StationDetailsPage({
	station,
	data,
	crafts,
}: {
	station: Station;
	data: HideoutPageData;
	crafts?: ReactNode;
}) {
	const stations = useMemo(() => data.stations ?? [station], [data.stations, station]);
	const items = useDeferredPriceItems(data.items);
	const itemById = useMemo(() => Object.fromEntries((items ?? []).map((item) => [item.id, item])), [items]);
	const store = useUserStore(
		useShallow((state) => ({
			stationLevels: state.stationLevels,
			hiddenStations: state.hiddenStations,
			showHidden: state.showHidden,
			checklistViewMode: state.checklistViewMode,
			completedRequirements: state.completedRequirements,
			toggleRequirement: state.toggleRequirement,
			itemCounts: state.itemCounts,
		})),
	);
	const currentLevel = store.stationLevels[station.id] ?? 0;
	const maxLevel = station.levels.length;
	const [picked, setPicked] = useState<LevelSelection | null>(null);
	const pooledFirByItem = useMemo(
		() =>
			Object.fromEntries(
				poolItems({
					stations,
					stationLevels: store.stationLevels,
					hiddenStations: store.hiddenStations,
					showHidden: store.showHidden,
					viewMode: store.checklistViewMode,
					completedRequirements: store.completedRequirements,
				}).map((item) => [item.id, item.firCount]),
			),
		[
			stations,
			store.stationLevels,
			store.hiddenStations,
			store.showHidden,
			store.checklistViewMode,
			store.completedRequirements,
		],
	);
	const upgradeStatus = computeStationUpgradeStatus({
		station,
		stations,
		stationLevels: store.stationLevels,
		itemById,
		itemCounts: store.itemCounts,
		pooledFirByItem,
	});
	const overviewRows = buildLevelOverview({
		station,
		currentLevel,
		upgradeStatus,
		itemById,
		itemCounts: store.itemCounts,
		pooledFirByItem,
		completedRequirements: store.completedRequirements,
	});
	const remainingItems = useMemo(
		() => remainingStationItems(station, currentLevel, store.completedRequirements),
		[station, currentLevel, store.completedRequirements],
	);
	const remaining = summarizeRemaining(overviewRows, remainingItems, itemById, store.itemCounts);
	// "All remaining" only exists while more than one level is left; otherwise fall back to the default level.
	const selection: LevelSelection | null =
		picked === "remaining" && remaining.levelCount <= 1
			? defaultViewedLevel(station, currentLevel)
			: (picked ?? defaultViewedLevel(station, currentLevel));
	const showingRemaining = selection === "remaining";
	const viewedLevelData = typeof selection === "number" ? getStationLevel(station, selection) : null;
	const prerequisiteLevels = showingRemaining
		? station.levels.filter((level) => level.level > currentLevel)
		: viewedLevelData
			? [viewedLevelData]
			: [];
	const unresolvedCount = showingRemaining
		? remaining.unresolvedItemIds.length
		: (viewedLevelData?.itemRequirements.filter((requirement) => !itemById[requirement.itemId]).length ?? 0);
	const nextRow = overviewRows.find((row) => row.state === "ready" || row.state === "next");
	const buildTime = showingRemaining ? remaining.constructionTime : (viewedLevelData?.constructionTime ?? 0);
	const missingNotice = unresolvedCount > 0 && (
		<DataNotice>
			{unresolvedCount} required item{unresolvedCount === 1 ? " is" : "s are"} missing from the catalog and cannot be
			shown.
		</DataNotice>
	);

	return (
		<StationDetailsProvider value={{ station, currentLevel }}>
			<main className="container mx-auto flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
				<nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-subtle-foreground">
					<Link href="/hideout" className="transition-colors hover:text-foreground">
						Hideout
					</Link>
					<ChevronRight size={12} aria-hidden="true" />
					<span aria-current="page" className="truncate text-muted-foreground">
						{station.name}
					</span>
				</nav>

				<header className="flex min-w-0 items-center gap-4">
					<StationImage station={station} size={56} />
					<h1 className="truncate text-2xl font-bold leading-tight text-foreground sm:text-3xl">{station.name}</h1>
				</header>

				{/* Mobile order: level card, main panel, sidebar. Desktop: main panel spans both right-column rows. */}
				<div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:grid-rows-[auto_1fr]">
					{maxLevel > 0 && (
						<section
							aria-label={`${station.name} level`}
							className="flex flex-col rounded-md border border-border-color bg-card/45 p-3 lg:col-start-2 lg:row-start-1"
						>
							<LevelControls station={station} itemById={itemById} upgradeStatus={upgradeStatus} />
							<LevelSummary nextRow={nextRow} remaining={remaining} />
						</section>
					)}

					<article className="min-w-0 self-start overflow-hidden rounded-md bg-surface-raised/50 lg:col-start-1 lg:row-span-2 lg:row-start-1">
						{selection != null && maxLevel > 1 && (
							<LevelOverview
								stationName={station.name}
								rows={overviewRows}
								remaining={remaining}
								selection={selection}
								onSelect={setPicked}
							/>
						)}
						<div className="flex flex-col divide-y divide-highlight/6 *:px-4 *:py-5 sm:*:px-5">
							{showingRemaining || viewedLevelData ? (
								<WikiSection
									title={
										showingRemaining
											? `Items for levels ${remaining.fromLevel}–${remaining.toLevel}`
											: `Level ${viewedLevelData?.level} requirements`
									}
									actions={
										buildTime > 0 ? (
											<span className="flex items-center gap-1 text-xs text-muted-foreground">
												<Clock size={12} aria-hidden="true" />
												{formatDuration(buildTime)}
											</span>
										) : undefined
									}
									bodyClassName="flex flex-col gap-3"
								>
									{missingNotice}
									{showingRemaining ? (
										remainingItems.length > 0 ? (
											<RemainingItemsList items={remainingItems} itemById={itemById} itemCounts={store.itemCounts} />
										) : (
											<DataNotice tone="empty">No item requirements remain.</DataNotice>
										)
									) : viewedLevelData && viewedLevelData.itemRequirements.length > 0 ? (
										<ExpandedItemRequirements
											nextLevelData={viewedLevelData}
											hideMoney={false}
											completedRequirements={store.completedRequirements}
											toggleRequirement={store.toggleRequirement}
											pooledFirByItem={pooledFirByItem}
											itemById={itemById}
										/>
									) : (
										<DataNotice tone="empty">No item requirements for this level.</DataNotice>
									)}
								</WikiSection>
							) : (
								<div>
									<DataNotice tone="empty">This station has no upgrade levels.</DataNotice>
								</div>
							)}
							{crafts}
						</div>
					</article>

					<aside className="flex flex-col gap-5 lg:col-start-2 lg:row-start-2">
						{prerequisiteLevels.length > 0 && (
							<PrerequisitesCard
								station={station}
								levels={prerequisiteLevels}
								stations={stations}
								stationLevels={store.stationLevels}
							/>
						)}
						<RequiredByList station={station} stations={stations} currentLevel={currentLevel} />
					</aside>
				</div>
			</main>
		</StationDetailsProvider>
	);
}
