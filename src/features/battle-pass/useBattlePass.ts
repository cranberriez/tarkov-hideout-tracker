"use client";

import { useCallback, useMemo, useState } from "react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
	commitInventoryUpdate,
	completeInventoryTiles,
	inventoryProgress,
	prepareInventoryUpdate,
	type InventoryUpdate,
} from "./lib/battle-pass-inventory";
import { parseProgress, type Progress } from "./lib/battle-pass-model";

// The pass is account-wide across PVP/PVE/KORD, independent of character progress.
export const BATTLE_PASS_STORAGE_KEY = "tarkov-battle-pass-season-1-v1";
export function useBattlePass() {
	const [raw, write] = useStoredProfitValue(BATTLE_PASS_STORAGE_KEY);
	const itemCounts = useUserStore((state) => state.itemCounts);
	const [consumeDocs, setConsumeDocs] = useState(false);
	const progress = useMemo(() => inventoryProgress(parseProgress(raw), itemCounts), [raw, itemCounts]);
	// Storage transforms remain pure; profile effects run once after the completed save.
	const commit = useCallback(
		(prepare: (stored: Progress, counts: typeof itemCounts) => InventoryUpdate) => {
			const state = useUserStore.getState();
			commitInventoryUpdate(write, state.itemCounts, prepare, state.addItemCounts);
		},
		[write],
	);
	const update = useCallback(
		(transform: (current: Progress) => Progress) => {
			commit((stored, counts) => prepareInventoryUpdate(stored, transform(inventoryProgress(stored, counts)), counts));
		},
		[commit],
	);
	const completeTiles = useCallback(
		(ids: string[]) => {
			commit((stored, counts) => completeInventoryTiles(stored, counts, ids, consumeDocs));
		},
		[commit, consumeDocs],
	);
	const toggleTile = useCallback(
		(id: string) => {
			commit((stored, counts) =>
				stored.completed.includes(id)
					? { progress: { ...stored, completed: stored.completed.filter((entry) => entry !== id) }, changes: [] }
					: completeInventoryTiles(stored, counts, [id], consumeDocs),
			);
		},
		[commit, consumeDocs],
	);
	return [progress, update, { completeTiles, toggleTile, consumeDocs, setConsumeDocs }] as const;
}
