import { CASH_TOLERANCE_CENTS, optimizeRouteFunding } from "./funding-model";
import { gatheringDailyCap } from "./gathering-caps";
import { gatheringScenario, type GatheringFilters, type SavingsRoute } from "./gathering-savings-model";

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

/** Price gathering `target` documents on a fixed route with `filters`. One funding solve. */
export function previewGathering(
	route: SavingsRoute,
	target: number,
	filters: GatheringFilters,
	startingTarCoins: number,
	allowSpecial: boolean,
	reserve = 0,
): GatheringPreview {
	const { claims, quantities } = gatheringScenario(route, target, filters);
	const byMode = new Map<string, number>();
	for (const row of quantities) byMode.set(row.profileKey, (byMode.get(row.profileKey) ?? 0) + row.quantity);
	return {
		gathered: quantities.reduce((sum, row) => sum + row.quantity, 0),
		cashCents: optimizeRouteFunding(claims, startingTarCoins, allowSpecial).cashCents,
		days: Math.max(0, ...[...byMode].map(([key, quantity]) => Math.ceil(quantity / gatheringDailyCap(key, reserve)))),
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
		);
	const all = price([]);
	// Only types the route still misses matter; maps covering none of them never help.
	const needed = [
		...new Set(
			route.claims.flatMap((claim) =>
				Object.entries(claim.cost)
					.filter(([key, cost]) => cost > (claim.ordinaryUsed[key] ?? 0))
					.map(([key]) => key),
			),
		),
	].filter((key) => mapNames[key]?.length);
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
