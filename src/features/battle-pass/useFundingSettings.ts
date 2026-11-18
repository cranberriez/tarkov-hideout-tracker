"use client";

import { useMemo } from "react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";

export const FUNDING_SETTINGS_KEY = "tarkov-battle-pass-funding-v1";

function readSettings(raw: string | null): Record<string, unknown> {
	try {
		const value: unknown = JSON.parse(raw ?? "{}");
		return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

export function useFundingSettings() {
	const [raw, write] = useStoredProfitValue(FUNDING_SETTINGS_KEY);
	const settings = useMemo(() => {
		const value = readSettings(raw);
		return {
			startingTarCoins:
				typeof value.startingTarCoins === "number" && Number.isFinite(value.startingTarCoins)
					? Math.max(0, Math.min(9999999, Math.floor(value.startingTarCoins)))
					: 0,
			allowSpecial: value.allowSpecial === true,
		};
	}, [raw]);
	return {
		...settings,
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
		setAllowSpecial: (value: boolean) =>
			write((current) => JSON.stringify({ version: 1, ...readSettings(current), allowSpecial: value })),
	};
}
