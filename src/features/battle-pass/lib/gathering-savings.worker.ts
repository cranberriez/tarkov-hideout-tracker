import {
	buildGatheringSavings,
	cashFreeGatheringPlan,
	type GatheringFilters,
	type SavingsRoute,
} from "./gathering-savings-model";

/** Gathering breakpoints (capped at the days left in the season) and the
 * fastest cash-free plan for one route; the page compares its days with the
 * season end. Both repeat many funding solves, so they run off the page thread. */
self.onmessage = (
	event: MessageEvent<{
		route: SavingsRoute;
		startingTarCoins: number;
		allowSpecial: boolean;
		filters: GatheringFilters;
		reserve: number;
		/** Days left in the season: no mode gathers beyond it. */
		days: number;
	}>,
) => {
	const { route, startingTarCoins, allowSpecial, filters, reserve, days } = event.data;
	let cashFree = null;
	try {
		cashFree = cashFreeGatheringPlan(route, startingTarCoins, filters, reserve);
	} catch {
		// No cash-free plan to show.
	}
	try {
		self.postMessage({
			breakpoints: buildGatheringSavings(route, startingTarCoins, allowSpecial, filters, reserve, days),
			cashFree,
		});
	} catch {
		self.postMessage({ cashFree, error: "Could not calculate gathering savings. Try again." });
	}
};
