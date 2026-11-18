"use client";
import { useMemo, useState } from "react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import type { Tile } from "./lib/battle-pass-model";
import type { SeasonId } from "@/lib/cfg/seasons";
import {
	mergeConfiguration,
	defaultConfiguration,
	defaultsEnabled,
	setDefaultsEnabled,
	hasCustomConfiguration,
	resizeRewardCost,
	parseConfiguration,
	type CostEntry,
	type RewardConfiguration,
} from "./lib/battle-pass-configuration";

export function useBattlePassConfiguration(seasonId: SeasonId, tiles: Tile[]) {
	const [raw, write] = useStoredProfitValue(`tarkov-battle-pass-costs-${seasonId}-v1`);
	const stored = useMemo(() => parseConfiguration(raw), [raw]);
	const usingDefaults = defaultsEnabled(raw);
	const defaults = useMemo(() => defaultConfiguration(tiles), [tiles]);
	const [editing, setEditing] = useState<{ baseline: RewardConfiguration; draft: RewardConfiguration } | null>(null);
	const [error, setError] = useState("");
	const dirty = editing !== null && JSON.stringify(editing.baseline) !== JSON.stringify(editing.draft);
	return {
		editing: editing !== null,
		dirty,
		error,
		configuration: editing?.draft ?? (usingDefaults ? defaults : stored),
		usingDefaults,
		begin: () => {
			setError("");
			setEditing({ baseline: stored, draft: structuredClone(stored) });
		},
		toggleDefaults: () => {
			if (editing) return;
			if (
				!usingDefaults &&
				hasCustomConfiguration(stored, tiles) &&
				!window.confirm(
					"Use default values instead of your custom costs? Some battle pass items may have incorrect values. Your custom costs will be kept and restored when you turn Use Defaults off.",
				)
			)
				return;
			try {
				write((latest) => setDefaultsEnabled(latest, !usingDefaults));
				setError("");
			} catch (failure) {
				setError(failure instanceof Error ? failure.message : "Could not switch cost source.");
			}
		},

		change: (id: string, entries: CostEntry[]) =>
			setEditing((current) => {
				if (!current) return current;
				const draft = { ...current.draft };
				const cost = draft[id];
				if (cost && !Array.isArray(cost)) draft[id] = { ...cost, entries };
				else if (entries.every((entry) => !entry.key && !entry.quantity)) delete draft[id];
				else draft[id] = entries;
				return { ...current, draft };
			}),
		changeTypeCount: (tile: Tile, count: number) =>
			setEditing((current) =>
				current
					? {
							...current,
							draft: { ...current.draft, [tile.id]: resizeRewardCost(current.draft[tile.id], count) },
						}
					: current,
			),
		save: () => {
			if (!editing) return;
			try {
				write((latest) => setDefaultsEnabled(mergeConfiguration(latest, editing.baseline, editing.draft), false));
				setEditing(null);
				setError("");
			} catch (failure) {
				setError(failure instanceof Error ? failure.message : "Could not save costs.");
			}
		},
		cancel: () => {
			if (dirty && !window.confirm("Discard your unsaved document cost changes?")) return;
			setEditing(null);
			setError("");
		},
	};
}
