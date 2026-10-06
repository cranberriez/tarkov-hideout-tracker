"use client";

import { useDeferredPriceItems } from "@/features/items/DeferredPriceBoundary";

import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { HideoutControls } from "@/features/hideout/components/HideoutControls";
import { HideoutConversionGate } from "@/features/hideout/components/HideoutConversionGate";
import { HideoutList } from "@/features/hideout/components/HideoutList";
import { DataLoadError } from "@/components/core/DataLoadError";
import { DataNotice } from "@/components/ui/data-notice";
import type { HideoutPageData } from "@/types/contracts";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStoreHydrated } from "@/lib/query/game-data";

interface HideoutClientPageProps {
	data: HideoutPageData;
	dataMode: TarkovJsonGameMode;
}

export function HideoutClientPage({ data, dataMode }: HideoutClientPageProps) {
	const { stations, items: initialItems, unresolvedItemIds, freshness, errors } = data;
	const items = useDeferredPriceItems(initialItems);
	const itemById = useMemo(() => Object.fromEntries((items ?? []).map((item) => [item.id, item])), [items]);
	const hydrated = useUserStoreHydrated();
	const [goalsMode, setGoalsMode] = useState(false);
	const { gameMode, initializeDefaults, hasSeenHideoutLevelWarning, setHasSeenHideoutLevelWarning } = useUserStore(
		useShallow((state) => ({
			gameMode: state.gameMode,
			initializeDefaults: state.initializeDefaults,
			hasSeenHideoutLevelWarning: state.hasSeenHideoutLevelWarning,
			setHasSeenHideoutLevelWarning: state.setHasSeenHideoutLevelWarning,
		})),
	);

	useEffect(() => {
		if (hydrated && toTarkovJsonGameMode(gameMode) === dataMode && stations && stations.length > 0) {
			initializeDefaults(stations);
		}
	}, [dataMode, gameMode, hydrated, stations, freshness.stationsUpdatedAt, initializeDefaults]);

	return (
		<main className="container mx-auto px-6 py-8">
			<div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold text-foreground tracking-tight">HIDEOUT STATIONS</h1>
				</div>
				<div className="flex flex-col w-full md:w-auto">
					<HideoutControls goalsMode={goalsMode} onGoalsModeChange={setGoalsMode} />
					{stations && <HideoutConversionGate stations={stations} />}
				</div>
			</div>

			{!hasSeenHideoutLevelWarning && (
				<div className="mb-4 flex items-center gap-3 rounded border border-warning/40 bg-warning-surface/20 px-3 py-2 text-xs text-warning w-full">
					<div className="flex-1">
						Increasing or decreasing station levels will affect your item counts. Use Setup at the top to modify base
						station levels without adjusting item requirements.
					</div>
					<button
						type="button"
						onClick={() => setHasSeenHideoutLevelWarning(true)}
						className="ml-2 text-[10px] uppercase tracking-wide font-mono text-warning hover:text-warning hover:bg-warning/20 rounded px-2 py-1"
					>
						Close
					</button>
				</div>
			)}

			{goalsMode && (
				<div className="mb-4 flex items-center gap-3 rounded border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-foreground">
					<div className="flex-1">
						<span className="font-semibold">Station goals.</span> Pick the level you want each station to reach. Items
						for levels above a goal are ignored on the Items checklist and Inventory, and Ignore drops the station
						entirely. Levels another goal depends on are counted automatically. King (the default) tracks every level.
					</div>
					<button
						type="button"
						onClick={() => setGoalsMode(false)}
						className="ml-2 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-brand hover:bg-brand/20"
					>
						Done
					</button>
				</div>
			)}

			{errors.stations || errors.items || !stations || !items ? (
				<DataLoadError
					title="Hideout data is unavailable"
					messages={[
						errors.stations,
						errors.items,
						!stations ? "Hideout station data could not be loaded." : null,
						!items ? "Hideout item data could not be loaded." : null,
					].filter((message): message is string => Boolean(message))}
				/>
			) : (
				<>
					{unresolvedItemIds.length > 0 && (
						<DataNotice className="mb-4">
							{unresolvedItemIds.length} hideout item
							{unresolvedItemIds.length === 1 ? " is" : "s are"} missing from the catalog. Affected station upgrades are
							disabled until the data source is complete.
						</DataNotice>
					)}
					<HideoutList
						stations={stations}
						itemById={itemById}
						stationsUpdatedAt={freshness.stationsUpdatedAt}
						itemsUpdatedAt={freshness.itemsUpdatedAt}
						goalsMode={goalsMode}
					/>
				</>
			)}
		</main>
	);
}
