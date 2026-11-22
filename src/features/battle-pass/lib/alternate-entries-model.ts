import { optimizeRouteFunding } from "./funding-model";
import { gatheringDailyCap } from "./gathering-caps";
import {
	gatheringScenario,
	type GatheringBreakpoint,
	type GatheringFilters,
	type SavingsRoute,
} from "./gathering-savings-model";
import { routeSwaps, type RouteSwap } from "./route-options-model";

/** At most this many alternate entries are shown, best savings first. */
export const ALTERNATE_ENTRY_LIMIT = 8;

/** One selectable row of the gathering-target list. */
export interface RouteEntry {
	/** 0 is the fewest-documents route; i is alternatives[i - 1]. */
	routeIndex: number;
	/** The MINIMUM count that reaches `cashCents` on that route: a true breakpoint of it (0 = no gathering). */
	gathered: number;
	cashCents: number;
	/** Against no gathering on the fewest-documents route (the list's baseline). */
	savingsCents: number;
	tarCoinsLeft: number;
	windows: GatheringBreakpoint["windows"];
	parallelWindows: number;
	/** Against the fewest-documents route; empty for route 0. */
	swaps: RouteSwap[];
	/** Alternates only: against its plain neighbor, the fewest-documents point nearest in documents gathered
	 * (count 0 included; the lower on a tie). */
	versus?: { neighborGathered: number; gatheredDelta: number; cashDeltaCents: number; tarCoinsLeftDelta: number };
}

/** A route-0 breakpoint as an entry. */
export function baseEntry(point: GatheringBreakpoint, baseline: number): RouteEntry {
	return {
		routeIndex: 0,
		gathered: point.gathered,
		cashCents: point.cashCents,
		savingsCents: baseline - point.cashCents,
		tarCoinsLeft: point.plan.balanceTarCoins,
		windows: point.windows,
		parallelWindows: point.parallelWindows,
		swaps: [],
	};
}

function entryWindows(route: SavingsRoute, count: number, filters: GatheringFilters, days: number, reserve: number) {
	const windows: GatheringBreakpoint["windows"] = [];
	for (const row of gatheringScenario(route, count, filters, days, reserve).quantities) {
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
	return { windows, parallelWindows: Math.max(0, ...windows.map((row) => row.windows)) };
}

/** Prices and builds entries for `routes` (routes[0] is the fewest-documents route). */
function entryBuilder(
	routes: SavingsRoute[],
	base: GatheringBreakpoint[],
	baseline: number,
	filters: GatheringFilters,
	days: number,
	reserve: number,
	wallet: number,
	allowSpecial: boolean,
) {
	const caches = routes.map(() => new Map<number, { cashCents: number; tarCoinsLeft: number }>());
	/** The same funding Route funding shows for the route gathering `count`; memoized. */
	const price = (routeIndex: number, count: number) => {
		const cache = caches[routeIndex];
		let priced = cache.get(count);
		if (!priced) {
			const plan = optimizeRouteFunding(
				gatheringScenario(routes[routeIndex], count, filters, days, reserve).claims,
				wallet,
				allowSpecial,
			);
			priced = { cashCents: plan.cashCents, tarCoinsLeft: plan.balanceTarCoins };
			cache.set(count, priced);
		}
		return priced;
	};
	/** The route's breakpoints stop one document short of gathering everything. */
	const maximum = (routeIndex: number) => Math.max(0, routes[routeIndex].additionalClassified - 1);
	/** Smallest count whose cash equals the cash at `count` (cash never rises with count). */
	const minimumCount = (routeIndex: number, count: number) => {
		const target = price(routeIndex, count).cashCents;
		if (price(routeIndex, 0).cashCents <= target) return 0;
		let low = 0,
			high = count;
		while (high - low > 1) {
			const middle = Math.floor((low + high) / 2);
			if (price(routeIndex, middle).cashCents <= target) high = middle;
			else low = middle;
		}
		return high;
	};
	/** Route-0 points: no gathering, then every breakpoint. */
	const zero = price(0, 0);
	const points = [
		{ gathered: 0, cashCents: baseline, tarCoinsLeft: zero.tarCoinsLeft },
		...base.map((point) => ({
			gathered: point.gathered,
			cashCents: point.cashCents,
			tarCoinsLeft: point.plan.balanceTarCoins,
		})),
	];
	const at = (routeIndex: number, requested: number): RouteEntry => {
		const gathered = minimumCount(routeIndex, Math.min(Math.max(0, requested), maximum(routeIndex)));
		const { cashCents, tarCoinsLeft } = price(routeIndex, gathered);
		const entry: RouteEntry = {
			routeIndex,
			gathered,
			cashCents,
			savingsCents: baseline - cashCents,
			tarCoinsLeft,
			...entryWindows(routes[routeIndex], gathered, filters, days, reserve),
			swaps: routeIndex === 0 ? [] : routeSwaps(routes[0], routes[routeIndex]),
		};
		if (routeIndex > 0) {
			// The plain entry it is an alternate to: the nearest by documents gathered (the lower on a tie).
			const versus = points.reduce((best, point) =>
				Math.abs(point.gathered - gathered) < Math.abs(best.gathered - gathered) ? point : best,
			);
			entry.versus = {
				neighborGathered: versus.gathered,
				gatheredDelta: gathered - versus.gathered,
				cashDeltaCents: cashCents - versus.cashCents,
				tarCoinsLeftDelta: tarCoinsLeft - versus.tarCoinsLeft,
			};
		}
		return entry;
	};
	return { at, points, maximum, price };
}

/** The entry of `routeIndex` that prices the same as gathering `count` there: its
 * minimum count for that cash. Undefined when the route cannot be priced. */
export function routeEntryAt(
	routes: SavingsRoute[],
	routeIndex: number,
	count: number,
	base: GatheringBreakpoint[],
	baseline: number,
	filters: GatheringFilters,
	days: number,
	reserve: number,
	wallet: number,
	allowSpecial: boolean,
): RouteEntry | undefined {
	try {
		return entryBuilder(routes, base, baseline, filters, days, reserve, wallet, allowSpecial).at(routeIndex, count);
	} catch {
		return undefined;
	}
}

/** Alternate-route entries worth listing beside the fewest-documents route's
 * breakpoints (`base`, whose cash at no gathering is `baseline`).
 *
 * Candidates: for every alternate, the counts of each route-0 point (and 0)
 * and that count plus the extra documents the alternate still has to buy
 * (`d`, so it gets the same documents bought), each reduced to the minimum count
 * with the same cash. The cash is the exact figure Route funding shows, so an
 * entry is a true breakpoint of its route and selecting it makes the worker
 * breakpoint at `gathered` equal `cashCents`.
 *
 * Show rule: kept only when no route-0 point (no gathering at `baseline`, or a
 * breakpoint) has cash <= the entry's with gathered <= the entry's and at least as
 * many TarCoins left (a swap that costs the same but keeps more TarCoins is shown); then entries
 * dominated the same way by another alternate's are dropped (ties keep the lower
 * route), and at most `limit` remain, best savings first (then fewer gathered).
 * Returned by gathered, then route. */
export function alternateEntries(
	routes: SavingsRoute[],
	base: GatheringBreakpoint[],
	baseline: number,
	filters: GatheringFilters,
	days: number,
	reserve: number,
	wallet: number,
	allowSpecial: boolean,
	limit = ALTERNATE_ENTRY_LIMIT,
): RouteEntry[] {
	if (routes.length < 2) return [];
	const builder = entryBuilder(routes, base, baseline, filters, days, reserve, wallet, allowSpecial);
	const found: RouteEntry[] = [];
	for (let routeIndex = 1; routeIndex < routes.length; routeIndex++) {
		try {
			const extra = Math.max(0, routes[routeIndex].additionalClassified - routes[0].additionalClassified);
			const counts = new Set(builder.points.flatMap((point) => [point.gathered, point.gathered + extra]));
			const seen = new Set<number>();
			for (const requested of counts) {
				const count = Math.min(requested, builder.maximum(routeIndex));
				const entry = builder.at(routeIndex, count);
				if (seen.has(entry.gathered)) continue;
				seen.add(entry.gathered);
				const dominated = builder.points.some(
					(point) =>
						point.cashCents <= entry.cashCents &&
						point.gathered <= entry.gathered &&
						point.tarCoinsLeft >= entry.tarCoinsLeft,
				);
				const { gatheredDelta, cashDeltaCents, tarCoinsLeftDelta } = entry.versus!;
				const equal = gatheredDelta === 0 && cashDeltaCents === 0 && tarCoinsLeftDelta === 0;
				if (!dominated && !equal) found.push(entry);
			}
		} catch {
			// A route that cannot be priced is skipped, as in priceRoutes.
		}
	}
	const beats = (a: RouteEntry, b: RouteEntry) =>
		a.cashCents <= b.cashCents &&
		a.gathered <= b.gathered &&
		a.tarCoinsLeft >= b.tarCoinsLeft &&
		(a.cashCents < b.cashCents ||
			a.gathered < b.gathered ||
			a.tarCoinsLeft > b.tarCoinsLeft ||
			a.routeIndex < b.routeIndex);
	return found
		.filter((entry) => !found.some((other) => other !== entry && beats(other, entry)))
		.sort((a, b) => b.savingsCents - a.savingsCents || a.gathered - b.gathered || a.routeIndex - b.routeIndex)
		.slice(0, limit)
		.sort((a, b) => a.gathered - b.gathered || a.routeIndex - b.routeIndex);
}
