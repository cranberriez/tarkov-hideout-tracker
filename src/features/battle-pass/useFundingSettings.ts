"use client";

import { useMemo } from "react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";

import type { GatheringFilters } from "./lib/gathering-savings-model";

export const FUNDING_SETTINGS_KEY = "tarkov-battle-pass-funding-v1";

function readSettings(raw: string | null): Record<string, unknown> {
	try {
		const value: unknown = JSON.parse(raw ?? "{}");
		return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function excludedKeys(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((key): key is string => typeof key === "string") : [];
}

export function readGatheringFilters(value: unknown): GatheringFilters {
	return Object.fromEntries(
		Object.entries(record(value)).map(([profile, entry]) => {
			const filter = record(entry);
			return [profile, { disabled: filter.disabled === true, excluded: excludedKeys(filter.excluded) }];
		}),
	);
}

export function updateGatheringChoice(raw: string | null, profile: string, enabled: boolean, document?: string) {
	const current = readSettings(raw);
	const filters = record(current.gatheringFilters);
	const filter = record(filters[profile]);
	const excluded = new Set(excludedKeys(filter.excluded));
	if (document !== undefined) {
		if (enabled) excluded.delete(document);
		else excluded.add(document);
	}
	const change = document === undefined ? { disabled: !enabled } : { excluded: [...excluded] };
	return JSON.stringify({
		version: 1,
		...current,
		gatheringFilters: { ...filters, [profile]: { ...filter, ...change } },
	});
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
			gatheringFilters: readGatheringFilters(value.gatheringFilters),
		};
	}, [raw]);
	return {
		...settings,
		setGatheringChoice: (profile: string, enabled: boolean, document?: string) =>
			write((current) => updateGatheringChoice(current, profile, enabled, document)),
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
