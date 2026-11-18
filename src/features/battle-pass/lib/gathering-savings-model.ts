import type { interpretDocumentRoute } from "./document-route-model";
import { compareCurrencyBundles, type CurrencyComparison, optimizeRouteFunding, rewardTarCoins } from "./funding-model";
import { gatheringDailyCap } from "./gathering-caps";

export type SavingsRoute = ReturnType<typeof interpretDocumentRoute>;
export interface GatheringQuantity {
	profileKey: string;
	profileLabel: string;
	documentKey: string;
	quantity: number;
}
export type GatheringFilters = Record<string, { disabled?: boolean; excluded?: string[] }>;
export interface GatheringBreakpoint {
	gathered: number;
	quantities: GatheringQuantity[];
	windows: { profileKey: string; profileLabel: string; quantity: number; cap: number; windows: number }[];
	parallelWindows: number;
	cashCents: number;
	savingsCents: number;
	remainingClassified: number;
	funding: CurrencyComparison;
}

/** Fixed selected rewards, owners and claim order. Gather matching shortages in
 * claim order; replay shared owned classified after ordinary stock every time.
 * This is a concrete gathering path, not an optimization over all gathering paths. */
export function gatheringScenario(
	route: SavingsRoute,
	gathered: number,
	filters: GatheringFilters = {},
	days = Infinity,
) {
	const gatheredByProfile = new Map<string, number>();
	let remaining = gathered;
	let classified = route.claims.reduce((sum, claim) => sum + claim.classifiedUsed, 0);
	const quantities: GatheringQuantity[] = [];
	const coins = new Map(route.selected.map((tile) => [tile.id, rewardTarCoins(tile)]));
	const claims = route.claims.map((claim) => {
		let shortfall = 0;
		for (const [documentKey, cost] of Object.entries(claim.cost)) {
			const missing = Math.max(0, cost - (claim.ordinaryUsed[documentKey] ?? 0));
			const filter = filters[claim.profileKey];
			const collected = gatheredByProfile.get(claim.profileKey) ?? 0;
			const capacity = days * gatheringDailyCap(claim.profileKey) - collected;
			const quantity =
				filter?.disabled || filter?.excluded?.includes(documentKey) ? 0 : Math.min(remaining, missing, capacity);
			gatheredByProfile.set(claim.profileKey, collected + quantity);
			remaining -= quantity;
			shortfall += missing - quantity;
			if (quantity) {
				const existing = quantities.find(
					(row) => row.profileKey === claim.profileKey && row.documentKey === documentKey,
				);
				if (existing) existing.quantity += quantity;
				else quantities.push({ profileKey: claim.profileKey, profileLabel: claim.profileLabel, documentKey, quantity });
			}
		}
		const used = Math.min(classified, shortfall);
		classified -= used;
		return {
			rewardId: claim.rewardId,
			page: claim.page,
			additionalClassified: shortfall - used,
			tarCoins: coins.get(claim.rewardId) ?? 0,
		};
	});
	return { claims, quantities };
}

/** Matching the earliest eligible shortages first minimizes every prefix deficit
 * for a given number of days on this route. Reward coins arrive after each claim. */
export function minimumFreeGatheringDays(route: SavingsRoute, wallet: number, filters: GatheringFilters) {
	const free = (days: number) => {
		const { claims } = gatheringScenario(route, Infinity, filters, days);
		return optimizeRouteFunding(claims, wallet, false).cashCents === 0;
	};
	if (!route.additionalClassified || free(0)) return 0;
	const totals = new Map<string, number>();
	for (const row of gatheringScenario(route, Infinity, filters).quantities)
		totals.set(row.profileKey, (totals.get(row.profileKey) ?? 0) + row.quantity);
	let low = 1,
		high = 0;
	for (const [key, quantity] of totals) high = Math.max(high, Math.ceil(quantity / gatheringDailyCap(key)));
	if (!high || !free(high)) return null;
	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		if (free(mid)) high = mid;
		else low = mid + 1;
	}
	return low;
}

export function cashFreeGatheringPlan(route: SavingsRoute, wallet: number, filters: GatheringFilters) {
	const days = minimumFreeGatheringDays(route, wallet, filters);
	if (days === null) return null;
	let low = 0,
		high = days ? route.additionalClassified : 0;
	// In the fastest window, stop as soon as the wallet and earned coins
	// cover the remaining claims. Later eligible documents are unnecessary.
	while (low < high) {
		const count = Math.floor((low + high) / 2);
		const { claims } = gatheringScenario(route, count, filters, days);
		if (optimizeRouteFunding(claims, wallet, false).cashCents === 0) high = count;
		else low = count + 1;
	}
	const { quantities } = gatheringScenario(route, low, filters, days);
	const modes = new Map<string, { label: string; documents: GatheringQuantity[] }>();
	for (const row of quantities) {
		const mode = modes.get(row.profileKey) ?? { label: row.profileLabel, documents: [] };
		mode.documents.push(row);
		modes.set(row.profileKey, mode);
	}
	return { days, total: low, modes };
}

/** Binary-search each next cash drop on the monotone gathering path. Avoids one
 * funding solve per document, and runs only on demand in a dedicated worker. */
export function buildGatheringSavings(
	route: SavingsRoute,
	startingTarCoins: number,
	allowSpecial: boolean,
	filters: GatheringFilters = {},
): GatheringBreakpoint[] {
	const maximum = route.additionalClassified - 1;
	if (maximum < 1) return [];
	const cache = new Map<number, CurrencyComparison>();
	const funding = (count: number) => {
		if (!cache.has(count))
			cache.set(
				count,
				compareCurrencyBundles(
					optimizeRouteFunding(gatheringScenario(route, count, filters).claims, startingTarCoins, allowSpecial),
					allowSpecial,
				),
			);
		return cache.get(count)!;
	};
	const cash = (count: number) => funding(count).cashCents;
	const baseline = cash(0);
	const minimum = cash(maximum);
	const result: GatheringBreakpoint[] = [];
	let count = 0;
	let previous = baseline;
	while (previous > minimum) {
		let low = count + 1,
			high = maximum;
		while (low < high) {
			const middle = Math.floor((low + high) / 2);
			if (cash(middle) < previous) high = middle;
			else low = middle + 1;
		}
		count = low;
		previous = cash(count);
		const { claims, quantities } = gatheringScenario(route, count, filters);
		const windows: GatheringBreakpoint["windows"] = [];
		for (const row of quantities) {
			let profile = windows.find((item) => item.profileKey === row.profileKey);
			if (!profile) {
				profile = {
					profileKey: row.profileKey,
					profileLabel: row.profileLabel,
					quantity: 0,
					cap: gatheringDailyCap(row.profileKey),
					windows: 0,
				};
				windows.push(profile);
			}
			profile.quantity += row.quantity;
			profile.windows = Math.ceil(profile.quantity / profile.cap);
		}
		result.push({
			gathered: count,
			quantities,
			windows,
			parallelWindows: Math.max(...windows.map((row) => row.windows)),
			cashCents: previous,
			funding: funding(count),
			savingsCents: baseline - previous,
			remainingClassified: claims.reduce((sum, claim) => sum + claim.additionalClassified, 0),
		});
	}
	return result;
}
