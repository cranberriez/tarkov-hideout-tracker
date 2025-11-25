"use client";

import { useEffect, useMemo } from "react";
import { useDataStore } from "@/lib/stores/useDataStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { StationCard } from "./StationCard";
import { stationOrder } from "@/lib/cfg/stationOrder";
import type { Station } from "@/types";
import { DataLastUpdated } from "@/components/computed/DataLastUpdated";

export function HideoutList() {
	const { stations, fetchStations, loadingStations, errorStations } = useDataStore();
	const { initializeDefaults, stationLevels } = useUserStore();

	useEffect(() => {
		fetchStations();
	}, [fetchStations]);

	useEffect(() => {
		if (stations) {
			initializeDefaults(stations);
		}
	}, [stations, initializeDefaults]);

	// 2. Helper to check if station is locked
	const isStationLocked = (station: Station) => {
		if (!stations) return false;
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
		if (!stations) return [];

		// 1. Map normalized names to order index
		const orderMap = new Map(stationOrder.map((name, index) => [name, index]));
		const getOrder = (name: string) => orderMap.get(name) ?? 999;

		// 2. Sort all by order
		return [...stations].sort((a, b) => getOrder(a.normalizedName) - getOrder(b.normalizedName));
	}, [stations]);

	if (loadingStations) {
		return (
			<div className="flex items-center justify-center py-20">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tarkov-green"></div>
			</div>
		);
	}

	if (errorStations) {
		return <div className="text-center text-red-500 py-10">Error: {errorStations}</div>;
	}

	if (!stations) {
		return null;
	}

	return (
		<>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{sortedStations.map((station) => (
					<StationCard key={station.id} station={station} isLocked={isStationLocked(station)} />
				))}
			</div>

			<DataLastUpdated />
		</>
	);
}
