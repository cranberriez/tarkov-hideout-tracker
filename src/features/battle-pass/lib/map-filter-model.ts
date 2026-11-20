import { CASH_TOLERANCE_CENTS, optimizeRouteFunding } from "./funding-model";
import { gatheringScenario, parallelDays, type GatheringFilters, type SavingsRoute } from "./gathering-savings-model";

/** Document types that spawn on none of `maps`; null means every map, so nothing is excluded. */
export function mapExcludedTypes(maps: readonly string[] | null, mapNames: Record<string, readonly string[]>) {
	if (!maps) return [];
	const chosen = new Set(maps);
	return Object.entries(mapNames)
		.filter(([, names]) => !names.some((name) => chosen.has(name)))
		.map(([key]) => key);
}

/** The player's per-mode filters with map-excluded types added to every mode. */
export function applyMapFilter(
	filters: GatheringFilters,
	profileKeys: readonly string[],
	excluded: readonly string[],
): GatheringFilters {
	if (!excluded.length) return filters;
	const result: GatheringFilters = { ...filters };
	for (const key of profileKeys) {
		const filter = filters[key] ?? {};
		result[key] = { ...filter, excluded: [...new Set([...(filter.excluded ?? []), ...excluded])] };
	}
	return result;
}

export interface GatheringPreview {
	/** Documents gathered, at most the target. */
	gathered: number;
	cashCents: number;
	/** Days the slowest mode needs at its daily cap. */
	days: number;
}

/** Price gathering `target` documents on a fixed route with `filters`, each
 * mode gathering at most `days` daily allowances. One funding solve. */
export function previewGathering(
	route: SavingsRoute,
	target: number,
	filters: GatheringFilters,
	startingTarCoins: number,
	allowSpecial: boolean,
	reserve = 0,
	days = Infinity,
): GatheringPreview {
	const { claims, quantities } = gatheringScenario(route, target, filters, days, reserve);
	return {
		gathered: quantities.reduce((sum, row) => sum + row.quantity, 0),
		cashCents: optimizeRouteFunding(claims, startingTarCoins, allowSpecial).cashCents,
		days: parallelDays(quantities, reserve),
	};
}

export interface FewestMapsInput {
	route: SavingsRoute;
	target: number;
	/** The player's per-mode filters, without any map restriction. */
	filters: GatheringFilters;
	profileKeys: string[];
	maps: string[];
	mapNames: Record<string, string[]>;
	startingTarCoins: number;
	allowSpecial: boolean;
	reserve: number;
	/** Days left in the season: no mode gathers beyond it. */
	days: number;
}

/** Document types the route still misses after owned stock. */
function neededTypes(route: SavingsRoute) {
	return [
		...new Set(
			route.claims.flatMap((claim) =>
				Object.entries(claim.cost)
					.filter(([key, cost]) => cost > (claim.ordinaryUsed[key] ?? 0))
					.map(([key]) => key),
			),
		),
	];
}

/** Smallest set of maps that still gathers the full target at no extra cash
 * than every map. Only the document types a map set covers change the price,
 * so each distinct coverage is priced once. Ties prefer the lower cash, then
 * fewer days, then the listed map order. */
export function fewestMaps(input: FewestMapsInput): { maps: string[]; preview: GatheringPreview } {
	const { route, target, filters, profileKeys, maps, mapNames } = input;
	const price = (excluded: string[]) =>
		previewGathering(
			route,
			target,
			applyMapFilter(filters, profileKeys, excluded),
			input.startingTarCoins,
			input.allowSpecial,
			input.reserve,
			input.days,
		);
	const all = price([]);
	// Only types the route still misses matter; maps covering none of them never help.
	const needed = neededTypes(route).filter((key) => mapNames[key]?.length);
	const useful = maps.filter((map) => needed.some((key) => mapNames[key].includes(map)));
	const cache = new Map<string, GatheringPreview>();
	let best: { maps: string[]; preview: GatheringPreview } | null = null;
	for (let size = 1; size <= useful.length && !best; size++) {
		const combinations = (start: number, chosen: string[]): void => {
			if (chosen.length === size) {
				const covered = needed.filter((key) => mapNames[key].some((map) => chosen.includes(map)));
				const signature = covered.join("|");
				if (!cache.has(signature))
					cache.set(signature, price(mapExcludedTypes(chosen, mapNames).filter((key) => needed.includes(key))));
				const preview = cache.get(signature)!;
				if (preview.gathered < all.gathered || preview.cashCents > all.cashCents + CASH_TOLERANCE_CENTS) return;
				if (
					!best ||
					preview.cashCents < best.preview.cashCents ||
					(preview.cashCents === best.preview.cashCents && preview.days < best.preview.days)
				)
					best = { maps: [...chosen], preview };
				return;
			}
			for (let index = start; index < useful.length; index++) combinations(index + 1, [...chosen, useful[index]]);
		};
		combinations(0, []);
	}
	return best ?? { maps: [...maps], preview: all };
}

export type FewestTypesInput = Omit<FewestMapsInput, "maps" | "mapNames">;
export interface FewestTypesResult {
	/** Document types to keep gathering. */
	types: string[];
	/** Types to turn off in every mode. */
	excluded: string[];
	/** Types the current filters gather at the target. */
	gatheredTypes: string[];
	preview: GatheringPreview;
}

/** Fewest document types that still gather the full target at no extra cash
 * than every allowed type. `filters` are the applied filters (maps included);
 * only types some mode may gather and the route still misses are searched.
 * Each subset is checked for the gathered amount before its funding solve.
 * Ties prefer the lower cash, then fewer days. */
export function fewestTypes(input: FewestTypesInput): FewestTypesResult {
	const { route, target, filters, profileKeys, reserve, days } = input;
	const scenario = (excluded: string[]) =>
		gatheringScenario(route, target, applyMapFilter(filters, profileKeys, excluded), days, reserve);
	const base = scenario([]);
	const gatheredTypes = [...new Set(base.quantities.map((row) => row.documentKey))];
	const all = {
		gathered: base.quantities.reduce((sum, row) => sum + row.quantity, 0),
		cashCents: optimizeRouteFunding(base.claims, input.startingTarCoins, input.allowSpecial).cashCents,
		days: parallelDays(base.quantities, reserve),
	};
	const candidates = neededTypes(route).filter((key) =>
		profileKeys.some((profile) => !filters[profile]?.disabled && !filters[profile]?.excluded?.includes(key)),
	);
	let best: FewestTypesResult | null = null;
	for (let size = 0; size <= candidates.length && !best; size++) {
		const combinations = (start: number, chosen: string[]): void => {
			if (chosen.length === size) {
				const excluded = candidates.filter((key) => !chosen.includes(key));
				const { claims, quantities } = scenario(excluded);
				if (quantities.reduce((sum, row) => sum + row.quantity, 0) < all.gathered) return;
				const preview = {
					gathered: all.gathered,
					cashCents: optimizeRouteFunding(claims, input.startingTarCoins, input.allowSpecial).cashCents,
					days: parallelDays(quantities, reserve),
				};
				if (preview.cashCents > all.cashCents + CASH_TOLERANCE_CENTS) return;
				if (
					!best ||
					preview.cashCents < best.preview.cashCents ||
					(preview.cashCents === best.preview.cashCents && preview.days < best.preview.days)
				)
					best = { types: [...chosen], excluded, gatheredTypes, preview };
				return;
			}
			for (let index = start; index < candidates.length; index++)
				combinations(index + 1, [...chosen, candidates[index]]);
		};
		combinations(0, []);
	}
	return best ?? { types: candidates, excluded: [], gatheredTypes, preview: all };
}
