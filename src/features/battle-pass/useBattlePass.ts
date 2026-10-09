"use client";

import { useCallback, useMemo } from "react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import { parseProgress, type Progress } from "./battle-pass-model";

// The pass is account-wide across PVP/PVE/KORD, independent of character progress.
export const BATTLE_PASS_STORAGE_KEY = "tarkov-battle-pass-season-1-v1";
export function useBattlePass() {
	const [raw, write] = useStoredProfitValue(BATTLE_PASS_STORAGE_KEY);
	const progress = useMemo(() => parseProgress(raw), [raw]);
	const update = useCallback(
		(transform: (current: Progress) => Progress) => {
			write((current) => JSON.stringify({ version: 1, ...transform(parseProgress(current)) }));
		},
		[write],
	);
	return [progress, update] as const;
}
