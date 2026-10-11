"use client";

import { useCallback, useMemo } from "react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import {
	BATTLE_PASS_PREFERENCES_KEY,
	parsePreferences,
	updatePreference,
	type BattlePassPreferences,
} from "./lib/battle-pass-preferences";

export function useBattlePassPreferences() {
	const [raw, write] = useStoredProfitValue(BATTLE_PASS_PREFERENCES_KEY);
	const preferences = useMemo(() => parsePreferences(raw), [raw]);
	const setPreference = useCallback(
		<K extends keyof BattlePassPreferences>(key: K, value: BattlePassPreferences[K]) => {
			write((current) => updatePreference(current, key, value));
		},
		[write],
	);
	return [preferences, setPreference] as const;
}
