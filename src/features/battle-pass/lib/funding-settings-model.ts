import type { GatheringFilters } from "./gathering-savings-model";

export const FUNDING_SETTINGS_KEY = "tarkov-battle-pass-funding-v1";

/** What the plan may buy: TarCoins with cash and classified with TarCoins,
 * classified with TarCoins already held or earned only, or nothing. */
export type PurchaseMode = "cash" | "tarcoins" | "none";
export const PURCHASE_MODES: readonly PurchaseMode[] = ["cash", "tarcoins", "none"];

export function readSettings(raw: string | null): Record<string, unknown> {
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

/** Turn `documents` off in every mode of `profiles`, keeping each mode's other choices. */
export function excludeGatheringTypes(raw: string | null, profiles: readonly string[], documents: readonly string[]) {
	const current = readSettings(raw);
	const filters = record(current.gatheringFilters);
	const next = { ...filters };
	for (const profile of profiles) {
		const filter = record(filters[profile]);
		next[profile] = { ...filter, excluded: [...new Set([...excludedKeys(filter.excluded), ...documents])] };
	}
	return JSON.stringify({ version: 1, ...current, gatheringFilters: next });
}

/** Normalized funding and gathering settings; reads never rewrite a malformed save. */
export function parseFundingSettings(raw: string | null) {
	const value = readSettings(raw);
	return {
		startingTarCoins:
			typeof value.startingTarCoins === "number" && Number.isFinite(value.startingTarCoins)
				? Math.max(0, Math.min(9999999, Math.floor(value.startingTarCoins)))
				: 0,
		allowSpecial: value.allowSpecial === true,
		purchases: PURCHASE_MODES.includes(value.purchases as PurchaseMode) ? (value.purchases as PurchaseMode) : "cash",
		preferredMode: typeof value.preferredMode === "string" ? value.preferredMode : null,
		dailyHeadroom: value.dailyHeadroom === true,
		gatheringTarget:
			typeof value.gatheringTarget === "number" && Number.isFinite(value.gatheringTarget)
				? Math.max(0, Math.floor(value.gatheringTarget))
				: null,
		gatheringFilters: readGatheringFilters(value.gatheringFilters),
		/** Maps the player farms; null for every map. */
		gatheringMaps: Array.isArray(value.gatheringMaps)
			? value.gatheringMaps.filter((name): name is string => typeof name === "string")
			: null,
	};
}
export type FundingSettings = ReturnType<typeof parseFundingSettings>;
