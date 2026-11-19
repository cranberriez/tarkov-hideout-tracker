import {
	buildGatheringSavings,
	cashFreeGatheringPlan,
	type GatheringFilters,
	type SavingsRoute,
} from "./gathering-savings-model";

/** Gathering breakpoints and the fastest cash-free plan for one route. Both
 * repeat many funding solves, so they run off the page thread. */
self.onmessage = (
	event: MessageEvent<{
		route: SavingsRoute;
		startingTarCoins: number;
		allowSpecial: boolean;
		filters: GatheringFilters;
		reserve: number;
	}>,
) => {
	const { route, startingTarCoins, allowSpecial, filters, reserve } = event.data;
	let cashFree = null;
	try {
		cashFree = cashFreeGatheringPlan(route, startingTarCoins, filters, reserve);
	} catch {
		// No cash-free plan to show.
	}
	try {
		self.postMessage({
			breakpoints: buildGatheringSavings(route, startingTarCoins, allowSpecial, filters, reserve),
			cashFree,
		});
	} catch {
		self.postMessage({ cashFree, error: "Could not calculate gathering savings. Try again." });
	}
};
