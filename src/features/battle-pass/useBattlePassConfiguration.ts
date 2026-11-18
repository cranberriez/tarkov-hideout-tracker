"use client";
import { useMemo, useState } from "react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import type { SeasonId } from "@/lib/cfg/seasons";
import {
	mergeConfiguration,
	parseConfiguration,
	type CostEntry,
	type RewardConfiguration,
} from "./lib/battle-pass-configuration";

export function useBattlePassConfiguration(seasonId: SeasonId) {
	const [raw, write] = useStoredProfitValue(`tarkov-battle-pass-costs-${seasonId}-v1`);
	const stored = useMemo(() => parseConfiguration(raw), [raw]);
	const [editing, setEditing] = useState<{ baseline: RewardConfiguration; draft: RewardConfiguration } | null>(null);
	const [error, setError] = useState("");
	const dirty = editing !== null && JSON.stringify(editing.baseline) !== JSON.stringify(editing.draft);
	return {
		editing: editing !== null,
		dirty,
		error,
		configuration: editing?.draft ?? stored,
		begin: () => {
			setError("");
			setEditing({ baseline: stored, draft: structuredClone(stored) });
		},
		change: (id: string, entries: CostEntry[]) =>
			setEditing((current) => {
				if (!current) return current;
				const draft = { ...current.draft };
				if (entries.every((entry) => !entry.key && !entry.quantity)) delete draft[id];
				else draft[id] = entries;
				return { ...current, draft };
			}),
		save: () => {
			if (!editing) return;
			try {
				write((latest) => mergeConfiguration(latest, editing.baseline, editing.draft));
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
