"use client";

import { useMemo } from "react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import {
	excludeGatheringTypes,
	FUNDING_SETTINGS_KEY,
	parseFundingSettings,
	type PurchaseMode,
	readSettings,
	updateGatheringChoice,
} from "./lib/funding-settings-model";

export function useFundingSettings() {
	const [raw, write] = useStoredProfitValue(FUNDING_SETTINGS_KEY);
	const settings = useMemo(() => parseFundingSettings(raw), [raw]);
	return {
		...settings,
		setGatheringChoice: (profile: string, enabled: boolean, document?: string) =>
			write((current) => updateGatheringChoice(current, profile, enabled, document)),
		/** Stop gathering `documents` in every mode of `profiles`. */
		excludeGatheringTypes: (profiles: readonly string[], documents: readonly string[]) =>
			write((current) => excludeGatheringTypes(current, profiles, documents)),
		setStartingTarCoins: (value: number) => {
			if (!Number.isFinite(value)) return;
			write((current) =>
				JSON.stringify({
					version: 1,
					...readSettings(current),
					startingTarCoins: Math.max(0, Math.min(9999999, Math.floor(value))),
				}),
			);
		},
		/** Profile key whose mode receives claims that need gathering, "balanced" to
		 * spread gathering across modes, or null for no preference. */
		setPreferredMode: (value: string | null) =>
			write((current) => JSON.stringify({ version: 1, ...readSettings(current), preferredMode: value })),
		/** Documents to gather (a breakpoint's total), 0 for none. */
		setGatheringTarget: (value: number) =>
			write((current) => JSON.stringify({ version: 1, ...readSettings(current), gatheringTarget: value })),
		/** Plan each mode below its daily cap, leaving the scarce last documents. */
		setDailyHeadroom: (value: boolean) =>
			write((current) => JSON.stringify({ version: 1, ...readSettings(current), dailyHeadroom: value })),
		/** Maps to gather on, or null for every map. */
		setGatheringMaps: (value: string[] | null) =>
			write((current) => JSON.stringify({ version: 1, ...readSettings(current), gatheringMaps: value })),
		setPurchases: (value: PurchaseMode) =>
			write((current) => JSON.stringify({ version: 1, ...readSettings(current), purchases: value })),
		setAllowSpecial: (value: boolean) =>
			write((current) => JSON.stringify({ version: 1, ...readSettings(current), allowSpecial: value })),
	};
}
