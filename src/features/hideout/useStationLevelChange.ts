"use client";

import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import { levelChangeItemDeltas } from "./station-level-change";

/**
 * Saved-level changes for one station, shared by Hideout cards and the station page.
 * `adjustItems` (default true) also removes/refunds the level's item requirements.
 * Level up stays blocked while a next-level item is missing from the catalog.
 */
export function useStationLevelChange(station: Station, itemById: Readonly<Record<string, ItemSummary>>) {
	const { currentLevel, setStationLevel, addItemCounts } = useUserStore(
		useShallow((state) => ({
			currentLevel: state.stationLevels[station.id] ?? 0,
			setStationLevel: state.setStationLevel,
			addItemCounts: state.addItemCounts,
		})),
	);
	const maxLevel = station.levels.length;
	const nextLevelData = station.levels.find((level) => level.level === currentLevel + 1);
	const hasUnresolvedNextLevelItem =
		nextLevelData?.itemRequirements.some((requirement) => !itemById[requirement.itemId]) ?? false;
	const canLevelUp = currentLevel < maxLevel && !!nextLevelData && !hasUnresolvedNextLevelItem;
	const canLevelDown = currentLevel > 0;

	const levelUp = (adjustItems = true) => {
		if (!canLevelUp) return;
		if (adjustItems) {
			for (const delta of levelChangeItemDeltas(nextLevelData, "up", itemById)) {
				addItemCounts(delta.itemId, delta.haveDelta, delta.haveFirDelta);
			}
		}
		setStationLevel(station.id, currentLevel + 1);
	};

	const levelDown = (adjustItems = true) => {
		if (!canLevelDown) return;
		if (adjustItems) {
			const currentLevelData = station.levels.find((level) => level.level === currentLevel);
			for (const delta of levelChangeItemDeltas(currentLevelData, "down", itemById)) {
				addItemCounts(delta.itemId, delta.haveDelta, delta.haveFirDelta);
			}
		}
		setStationLevel(station.id, currentLevel - 1);
	};

	return { currentLevel, maxLevel, canLevelUp, canLevelDown, hasUnresolvedNextLevelItem, levelUp, levelDown };
}
