"use client";

import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { computeStationUpgradeStatus } from "../station-model";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import { useStationLevelChange } from "../useStationLevelChange";
import { StationCardHeader } from "./StationCardHeader";
import { StationRequirementsSection } from "./StationRequirementsSection";
import { StationGoalPicker } from "./StationGoalPicker";
import type { ResolvedStationGoal } from "@/lib/utils/station-goals";

interface StationCardProps {
	station: Station;
	stations: Station[];
	itemById: Readonly<Record<string, ItemSummary>>;
	isLocked?: boolean;
	pooledFirByItem: Record<string, number>;
	goal: ResolvedStationGoal | undefined;
	goalsMode: boolean;
}

export function StationCard({
	station,
	stations,
	itemById,
	isLocked = false,
	pooledFirByItem,
	goal,
	goalsMode,
}: StationCardProps) {
	const {
		stationLevels,
		hiddenStations,
		toggleHiddenStation,
		setStationGoal,
		hideoutCompactMode,
		showHidden,
		completedRequirements,
		toggleRequirement,
		hideMoney,
		hideRequirements,
		itemCounts,
	} = useUserStore(
		useShallow((state) => ({
			stationLevels: state.stationLevels,
			hiddenStations: state.hiddenStations,
			toggleHiddenStation: state.toggleHiddenStation,
			setStationGoal: state.setStationGoal,
			hideoutCompactMode: state.hideoutCompactMode,
			showHidden: state.showHidden,
			completedRequirements: state.completedRequirements,
			toggleRequirement: state.toggleRequirement,
			hideMoney: state.hideMoney,
			hideRequirements: state.hideRequirements,
			itemCounts: state.itemCounts,
		})),
	);

	const currentLevel = stationLevels[station.id] ?? 0;
	const maxLevel = station.levels.length;

	const nextLevelData = station.levels.find((l) => l.level === currentLevel + 1);
	const isMaxed = currentLevel >= maxLevel;
	const isHidden = hiddenStations[station.id] || isMaxed;
	const hasUnresolvedNextLevelItem =
		nextLevelData?.itemRequirements.some((requirement) => !itemById[requirement.itemId]) ?? false;

	const upgradeStatus = computeStationUpgradeStatus({
		station,
		stations,
		stationLevels,
		itemById,
		itemCounts,
		pooledFirByItem,
	});

	const { levelUp, levelDown } = useStationLevelChange(station, itemById);
	const handleLevelUp = () => levelUp();
	const handleLevelDown = () => levelDown();

	// If hidden and showHidden is false, don't render (handled by parent usually, but good safety)
	if (isHidden && !showHidden) return null;

	return (
		<div
			id={`hideout-station-${station.id}`}
			className={`bg-card border border-border-color rounded overflow-hidden flex flex-col transition-opacity ${
				isHidden ? "opacity-50 grayscale" : ""
			}`}
		>
			<StationCardHeader
				station={station}
				isLocked={isLocked}
				isHidden={isHidden}
				currentLevel={currentLevel}
				maxLevel={maxLevel}
				isMaxed={isMaxed}
				hideRequirements={hideRequirements && !goalsMode}
				toggleHiddenStation={toggleHiddenStation}
				onLevelDown={handleLevelDown}
				onLevelUp={handleLevelUp}
				upgradeStatus={upgradeStatus}
				hasUnresolvedItemData={hasUnresolvedNextLevelItem}
				goalCap={goal && goal.cap < maxLevel ? goal.cap : undefined}
			/>

			{/* Content */}
			{goalsMode && goal ? (
				<StationGoalPicker
					station={station}
					currentLevel={currentLevel}
					goal={goal}
					onGoalChange={(level) => setStationGoal(station.id, level)}
				/>
			) : (
				!hideRequirements && (
					<StationRequirementsSection
						station={station}
						isMaxed={isMaxed}
						nextLevelData={nextLevelData}
						stations={stations}
						stationLevels={stationLevels}
						completedRequirements={completedRequirements}
						toggleRequirement={toggleRequirement}
						hideMoney={hideMoney}
						hideoutCompactMode={hideoutCompactMode}
						pooledFirByItem={pooledFirByItem}
						itemById={itemById}
						upgradeStatus={upgradeStatus}
					/>
				)
			)}
		</div>
	);
}
