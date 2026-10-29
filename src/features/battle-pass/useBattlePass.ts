"use client";

import { useCallback, useMemo } from "react";
import { inventoryScopeIsCurrent } from "./lib/battle-pass-scope";
import { useBattlePassData, useBattlePassSave } from "./BattlePassSeason";
import { useCurrentSeason } from "@/features/seasons/useCurrentSeason";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
	commitInventoryUpdate,
	completeInventoryTiles,
	inventoryProgress,
	prepareInventoryUpdate,
	type InventoryUpdate,
} from "./lib/battle-pass-inventory";
import { setCostSwap, type Progress } from "./lib/battle-pass-model";
import { useBattlePassPreferences } from "./useBattlePassPreferences";

// The pass is account-wide across PVP/PVE/KORD, independent of character progress.
const EMPTY_COUNTS = {};
export const BATTLE_PASS_STORAGE_KEY = "tarkov-battle-pass-season-1-v1";
export function useBattlePass() {
	const data = useBattlePassData();
	const current = useCurrentSeason();
	const mode = useUserStore((state) => state.gameMode);
	const selectedSeason = useUserStore((state) => state.selectedSeasonId);
	const seasonalInventory = mode === "KORD" || data.seasonId !== current.id;
	const itemCounts = useUserStore((state) =>
		seasonalInventory ? (state.seasonalProfiles[data.seasonId]?.itemCounts ?? EMPTY_COUNTS) : state.itemCounts,
	);
	const { stored, write } = useBattlePassSave();
	const [{ consumeDocs }, setPreference] = useBattlePassPreferences();
	const setConsumeDocs = useCallback((checked: boolean) => setPreference("consumeDocs", checked), [setPreference]);
	const progress = useMemo(
		() => inventoryProgress(stored, itemCounts, data.documentItemIds),
		[stored, itemCounts, data],
	);
	// Storage transforms remain pure; profile effects run once after the completed save.
	const commit = useCallback(
		(prepare: (stored: Progress, counts: typeof itemCounts) => InventoryUpdate) => {
			const state = useUserStore.getState();
			// Callbacks from an earlier character visit cannot affect the newly selected character.
			if (
				!inventoryScopeIsCurrent(
					{ mode, selectedSeasonId: selectedSeason, seasonId: data.seasonId, seasonal: seasonalInventory },
					state,
				)
			)
				return;
			const counts = seasonalInventory
				? (state.seasonalProfiles[data.seasonId]?.itemCounts ?? EMPTY_COUNTS)
				: state.itemCounts;
			commitInventoryUpdate(
				write,
				counts,
				prepare,
				seasonalInventory
					? (itemId, have, fir) => state.addItemCountsForSeason(data.seasonId, itemId, have, fir)
					: state.addItemCounts,
			);
		},
		[write, mode, selectedSeason, seasonalInventory, data],
	);
	const update = useCallback(
		(transform: (current: Progress) => Progress) => {
			commit((stored, counts) =>
				prepareInventoryUpdate(
					stored,
					transform(inventoryProgress(stored, counts, data.documentItemIds)),
					counts,
					data.documentItemIds,
				),
			);
		},
		[commit, data],
	);
	const completeTiles = useCallback(
		(ids: string[]) => {
			commit((stored, counts) =>
				completeInventoryTiles(stored, counts, ids, consumeDocs, data.tiles, data.documentItemIds),
			);
		},
		[commit, consumeDocs, data],
	);
	const toggleTile = useCallback(
		(id: string) => {
			commit((stored, counts) =>
				stored.completed.includes(id)
					? { progress: { ...stored, completed: stored.completed.filter((entry) => entry !== id) }, changes: [] }
					: completeInventoryTiles(stored, counts, [id], consumeDocs, data.tiles, data.documentItemIds),
			);
		},
		[commit, consumeDocs, data],
	);
	const swapCost = useCallback(
		(tileId: string, from: string, to: string) =>
			commit((stored) => ({
				progress: { ...stored, costSwaps: setCostSwap(stored.costSwaps, tileId, from, to) },
				changes: [],
			})),
		[commit],
	);
	const resetCostSwaps = useCallback(
		() => commit((stored) => ({ progress: { ...stored, costSwaps: {} }, changes: [] })),
		[commit],
	);
	return [
		progress,
		update,
		{ completeTiles, toggleTile, consumeDocs, setConsumeDocs, swapCost, resetCostSwaps },
	] as const;
}
