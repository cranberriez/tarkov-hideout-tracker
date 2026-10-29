"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { StationCard } from "./StationCard";
import { stationOrder } from "@/lib/cfg/stationOrder";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import { DataLastUpdated } from "@/components/computed/DataLastUpdated";
import { poolItems } from "@/lib/utils/item-pooling";
import { useStationGoals } from "../useStationGoals";

interface HideoutListProps {
	stations: Station[];
	itemById: Readonly<Record<string, ItemSummary>>;
	stationsUpdatedAt: number | null;
	itemsUpdatedAt: number | null;
	goalsMode: boolean;
}

export function HideoutList({ stations, itemById, stationsUpdatedAt, itemsUpdatedAt, goalsMode }: HideoutListProps) {
	const { stationLevels, hiddenStations, checklistViewMode, showHidden, completedRequirements } = useUserStore(
		useShallow((state) => ({
			stationLevels: state.stationLevels,
			hiddenStations: state.hiddenStations,
			checklistViewMode: state.checklistViewMode,
			showHidden: state.showHidden,
			completedRequirements: state.completedRequirements,
		})),
	);

	const { resolved: goals, caps: goalCaps } = useStationGoals(stations);

	// 2. Helper to check if station is locked
	const isStationLocked = (station: Station) => {
		const currentLevel = stationLevels[station.id] ?? 0;
		const nextLevelData = station.levels.find((l) => l.level === currentLevel + 1);
		if (!nextLevelData) return false; // Maxed or invalid

		// Check station level requirements
		// If ANY requirement is not met, it is locked
		return nextLevelData.stationLevelRequirements.some((req) => {
			// Find the requirement station in our full list to get its ID (or store normalized -> level map)
			const reqStation = stations.find((s) => s.normalizedName === req.station.normalizedName);
			if (!reqStation) return false; // Should not happen
			const reqStationLevel = stationLevels[reqStation.id] ?? 0;
			return reqStationLevel < req.level;
		});
	};

	const sortedStations = useMemo(() => {
		// 1. Map normalized names to order index
		const orderMap = new Map(stationOrder.map((name, index) => [name, index]));
		const getOrder = (name: string) => orderMap.get(name) ?? 999;

		// 2. Sort all by order
		return [...stations].sort((a, b) => getOrder(a.normalizedName) - getOrder(b.normalizedName));
	}, [stations]);

	const pooledItems = useMemo(() => {
		return poolItems({
			stations,
			stationLevels,
			hiddenStations,
			showHidden,
			viewMode: checklistViewMode,
			completedRequirements,
			goalCaps,
		});
	}, [stations, stationLevels, hiddenStations, checklistViewMode, showHidden, completedRequirements, goalCaps]);

	const pooledFirByItem = useMemo(() => {
		const map: Record<string, number> = {};
		for (const item of pooledItems) {
			map[item.id] = item.firCount;
		}
		return map;
	}, [pooledItems]);

	return (
		<>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{sortedStations.map((station) => (
					<StationCard
						key={station.id}
						station={station}
						stations={stations}
						itemById={itemById}
						isLocked={isStationLocked(station)}
						pooledFirByItem={pooledFirByItem}
						goal={goals[station.id]}
						goalsMode={goalsMode}
					/>
				))}
			</div>

			<DataLastUpdated stationsUpdatedAt={stationsUpdatedAt} itemsUpdatedAt={itemsUpdatedAt} />
		</>
	);
}
