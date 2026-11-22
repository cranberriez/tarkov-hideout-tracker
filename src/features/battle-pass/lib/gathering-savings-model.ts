import type { interpretDocumentRoute } from "./document-route-model";
import {
	compareCurrencyBundles,
	type CurrencyComparison,
	type FundingPlan,
	optimizeRouteFunding,
	rewardTarCoins,
} from "./funding-model";
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
	/** The full purchase schedule behind `funding`, for the step-by-step plan. */
	plan: FundingPlan;
}

/** Fixed selected rewards, owners and claim order. Gather matching shortages in
 * claim order; replay shared owned classified after ordinary stock every time.
 * This is a concrete gathering path, not an optimization over all gathering paths. */
export function gatheringScenario(
	route: SavingsRoute,
	gathered: number,
	filters: GatheringFilters = {},
	days = Infinity,
	reserve = 0,
) {
	const gatheredByProfile = new Map<string, number>();
	let remaining = gathered;
	let classified = route.claims.reduce((sum, claim) => sum + claim.classifiedUsed, 0);
	const quantities: GatheringQuantity[] = [];
	const coins = new Map(route.selected.map((tile) => [tile.id, rewardTarCoins(tile)]));
	const gatheredByClaim: GatheringQuantity[][] = [];
	const claims = route.claims.map((claim) => {
		let shortfall = 0;
		const gatheredHere: GatheringQuantity[] = [];
		gatheredByClaim.push(gatheredHere);
		for (const [documentKey, cost] of Object.entries(claim.cost)) {
			const missing = Math.max(0, cost - (claim.ordinaryUsed[documentKey] ?? 0));
			const filter = filters[claim.profileKey];
			const collected = gatheredByProfile.get(claim.profileKey) ?? 0;
			const capacity = days * gatheringDailyCap(claim.profileKey, reserve) - collected;
			const quantity =
				filter?.disabled || filter?.excluded?.includes(documentKey) ? 0 : Math.min(remaining, missing, capacity);
			gatheredByProfile.set(claim.profileKey, collected + quantity);
			remaining -= quantity;
			shortfall += missing - quantity;
			if (quantity) {
				gatheredHere.push({ profileKey: claim.profileKey, profileLabel: claim.profileLabel, documentKey, quantity });
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
			classifiedUsed: used,
			tarCoins: coins.get(claim.rewardId) ?? 0,
		};
	});
	return { claims, quantities, gatheredByClaim };
}

/** Matching the earliest eligible shortages first minimizes every prefix deficit
 * for a given number of days on this route. Reward coins arrive after each claim. */
export function minimumFreeGatheringDays(route: SavingsRoute, wallet: number, filters: GatheringFilters, reserve = 0) {
	const free = (days: number) => {
		const { claims } = gatheringScenario(route, Infinity, filters, days, reserve);
		return optimizeRouteFunding(claims, wallet, false).cashCents === 0;
	};
	if (!route.additionalClassified || free(0)) return 0;
	const totals = new Map<string, number>();
	for (const row of gatheringScenario(route, Infinity, filters).quantities)
		totals.set(row.profileKey, (totals.get(row.profileKey) ?? 0) + row.quantity);
	let low = 1,
		high = 0;
	for (const [key, quantity] of totals) high = Math.max(high, Math.ceil(quantity / gatheringDailyCap(key, reserve)));
	if (!high || !free(high)) return null;
	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		if (free(mid)) high = mid;
		else low = mid + 1;
	}
	return low;
}

/** Parallel days the slowest mode needs for `quantities` at its daily cap. */
export function parallelDays(quantities: GatheringQuantity[], reserve = 0) {
	const byMode = new Map<string, number>();
	for (const row of quantities) byMode.set(row.profileKey, (byMode.get(row.profileKey) ?? 0) + row.quantity);
	return Math.max(0, ...[...byMode].map(([key, quantity]) => Math.ceil(quantity / gatheringDailyCap(key, reserve))));
}

/** Whole 24-hour gathering windows left before `endsAt`; Infinity without an end or before hydration. */
export function seasonDaysLeft(endsAt: number | null, now: number | null) {
	if (endsAt === null || now === null) return Infinity;
	return Math.max(0, Math.floor((endsAt - now) / 86_400_000));
}

export function cashFreeGatheringPlan(route: SavingsRoute, wallet: number, filters: GatheringFilters, reserve = 0) {
	const days = minimumFreeGatheringDays(route, wallet, filters, reserve);
	if (days === null) return null;
	let low = 0,
		high = days ? route.additionalClassified : 0;
	// In the fastest window, stop as soon as the wallet and earned coins
	// cover the remaining claims. Later eligible documents are unnecessary.
	while (low < high) {
		const count = Math.floor((low + high) / 2);
		const { claims } = gatheringScenario(route, count, filters, days, reserve);
		if (optimizeRouteFunding(claims, wallet, false).cashCents === 0) high = count;
		else low = count + 1;
	}
	const { quantities } = gatheringScenario(route, low, filters, days, reserve);
	const modes = new Map<string, { label: string; documents: GatheringQuantity[] }>();
	for (const row of quantities) {
		const mode = modes.get(row.profileKey) ?? { label: row.profileLabel, documents: [] };
		mode.documents.push(row);
		modes.set(row.profileKey, mode);
	}
	return { days, total: low, modes };
}

/** The breakpoint record for gathering `count` documents, priced by `solved`. */
function breakpointAt(
	route: SavingsRoute,
	count: number,
	filters: GatheringFilters,
	days: number,
	reserve: number,
	solved: { plan: FundingPlan; funding: CurrencyComparison },
	baselineCents: number,
): GatheringBreakpoint {
	const { claims, quantities } = gatheringScenario(route, count, filters, days, reserve);
	const windows: GatheringBreakpoint["windows"] = [];
	for (const row of quantities) {
		let profile = windows.find((item) => item.profileKey === row.profileKey);
		if (!profile) {
			profile = {
				profileKey: row.profileKey,
				profileLabel: row.profileLabel,
				quantity: 0,
				cap: gatheringDailyCap(row.profileKey, reserve),
				windows: 0,
			};
			windows.push(profile);
		}
		profile.quantity += row.quantity;
		profile.windows = Math.ceil(profile.quantity / profile.cap);
	}
	return {
		// An unlimited count gathers every eligible shortage; record what that is.
		gathered: Number.isFinite(count) ? count : quantities.reduce((sum, row) => sum + row.quantity, 0),
		quantities,
		windows,
		parallelWindows: Math.max(0, ...windows.map((row) => row.windows)),
		cashCents: solved.funding.cashCents,
		...solved,
		savingsCents: baselineCents - solved.funding.cashCents,
		remainingClassified: claims.reduce((sum, claim) => sum + claim.additionalClassified, 0),
	};
}

/** Fewest documents to gather (earliest shortages first) so owned classified
 * covers the rest; null when gathering every eligible shortage is not enough. */
function fewestToCoverAll(route: SavingsRoute, filters: GatheringFilters, reserve: number) {
	const left = (count: number) =>
		gatheringScenario(route, count, filters, Infinity, reserve).claims.reduce(
			(sum, claim) => sum + claim.additionalClassified,
			0,
		);
	if (left(Infinity) > 0) return null;
	let low = 0,
		high = route.additionalClassified + route.classifiedUsed;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (left(middle) === 0) high = middle;
		else low = middle + 1;
	}
	return low;
}

/** The gathering a purchase restriction forces. "tarcoins" gathers the fastest
 * cash-free amount; "none" gathers the fewest documents that, with owned
 * classified, cover every claim, without a season cap. Both fall back to
 * gathering every eligible shortage; `blocked` then counts the classified
 * documents still to buy (modes or document types turned off, or too few TarCoins). */
export function restrictedGathering(
	route: SavingsRoute,
	purchases: "tarcoins" | "none",
	startingTarCoins: number,
	filters: GatheringFilters,
	reserve = 0,
) {
	const free = purchases === "tarcoins" ? cashFreeGatheringPlan(route, startingTarCoins, filters, reserve) : null;
	const count = free
		? free.total
		: purchases === "none"
			? (fewestToCoverAll(route, filters, reserve) ?? Infinity)
			: Infinity;
	const days = free ? free.days : Infinity;
	const price = (gathered: number) => {
		const plan = optimizeRouteFunding(
			gatheringScenario(route, gathered, filters, days, reserve).claims,
			startingTarCoins,
			false,
		);
		return { plan, funding: compareCurrencyBundles(plan, false) };
	};
	const point = breakpointAt(route, count, filters, days, reserve, price(count), price(0).funding.cashCents);
	const blocked =
		purchases === "none" ? point.remainingClassified : point.cashCents > 0 ? point.remainingClassified : 0;
	return { purchases, point, days: free ? free.days : point.parallelWindows, scenarioDays: days, blocked };
}
export type RestrictedGathering = ReturnType<typeof restrictedGathering>;

/** Binary-search each next cash drop on the monotone gathering path. Avoids one
 * funding solve per document, and runs only on demand in a dedicated worker.
 * `days` caps each mode at that many daily allowances (the days left in the
 * season); documents beyond it are bought, so every breakpoint fits. */
export function buildGatheringSavings(
	route: SavingsRoute,
	startingTarCoins: number,
	allowSpecial: boolean,
	filters: GatheringFilters = {},
	reserve = 0,
	days = Infinity,
): GatheringBreakpoint[] {
	const maximum = route.additionalClassified - 1;
	if (maximum < 1) return [];
	const cache = new Map<number, { plan: FundingPlan; funding: CurrencyComparison }>();
	const solve = (count: number) => {
		if (!cache.has(count)) {
			const plan = optimizeRouteFunding(
				gatheringScenario(route, count, filters, days, reserve).claims,
				startingTarCoins,
				allowSpecial,
			);
			cache.set(count, { plan, funding: compareCurrencyBundles(plan, allowSpecial) });
		}
		return cache.get(count)!;
	};
	const cash = (count: number) => solve(count).funding.cashCents;
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
		result.push(breakpointAt(route, count, filters, days, reserve, solve(count), baseline));
	}
	return result;
}
