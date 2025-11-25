"use client";

import { useMemo } from "react";
import type { Station } from "@/types";
import { stationOrder } from "@/lib/cfg/stationOrder";

interface QuickHideoutLevelsProps {
	stations: Station[] | null;
	stationLevels: Record<string, number>;
	setStationLevel: (stationId: string, level: number) => void;
	loadingStations?: boolean;
}

export function QuickHideoutLevels({
	stations,
	stationLevels,
	setStationLevel,
	loadingStations,
}: QuickHideoutLevelsProps) {
	const sortedStations = useMemo(() => {
		if (!stations) return [];

		const orderMap = new Map(stationOrder.map((name, index) => [name, index]));
		const getOrder = (name: string) => orderMap.get(name) ?? 999;

		return [...stations].sort((a, b) => getOrder(a.normalizedName) - getOrder(b.normalizedName));
	}, [stations]);

	if (loadingStations) {
		return <div className="text-sm text-gray-400">Loading hideout stations...</div>;
	}

	if (!stations || sortedStations.length === 0) {
		return <div className="text-sm text-gray-500">Hideout station data is not available right now.</div>;
	}

	return (
		<div className="flex flex-col gap-4">
			<p className="text-xs text-gray-500">
				Quickly set your current level for each hideout station. Level 0 means not constructed.
			</p>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{sortedStations.map((station) => {
					const currentLevel = stationLevels[station.id] ?? 0;
					const maxLevel = station.levels.length > 0 ? station.levels[station.levels.length - 1].level : 0;

					const levels = Array.from({ length: maxLevel + 1 }, (_, idx) => idx);

					return (
						<div
							key={station.id}
							className="bg-black/40 border border-border-color rounded-md p-3 flex flex-col gap-2"
						>
							<div className="flex items-baseline justify-between gap-2">
								<div className="text-sm font-medium text-white truncate">{station.name}</div>
								<div className="text-[10px] text-gray-500 font-mono">
									LVL{" "}
									<span className={currentLevel > 0 ? "text-tarkov-green" : "text-gray-500"}>
										{currentLevel}
									</span>{" "}
									<span className="text-gray-600">/ {maxLevel}</span>
								</div>
							</div>
							<div className="flex flex-wrap gap-1.5">
								{levels.map((level) => {
									const isActive = level === currentLevel;
									return (
										<button
											key={level}
											type="button"
											onClick={() => setStationLevel(station.id, level)}
											className={`px-2.5 py-1 text-[11px] font-mono rounded-sm border transition-all ${
												isActive
													? "bg-tarkov-green text-black border-tarkov-green shadow-sm"
													: "border-white/10 text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/30"
											}`}
										>
											{level}
										</button>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
