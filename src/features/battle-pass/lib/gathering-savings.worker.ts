import {
	buildGatheringSavings,
	cashFreeGatheringPlan,
	restrictedGathering,
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
		purchases: "cash" | "tarcoins" | "none";
	}>,
) => {
	const { route, startingTarCoins, allowSpecial, filters, reserve, days, purchases } = event.data;
	let cashFree = null;
	try {
		cashFree = cashFreeGatheringPlan(route, startingTarCoins, filters, reserve);
	} catch {
		// No cash-free plan to show.
	}
	// A purchase restriction fixes the gathering, so there are no breakpoints to choose from.
	if (purchases !== "cash") {
		try {
			self.postMessage({
				breakpoints: [],
				cashFree,
				restricted: restrictedGathering(route, purchases, startingTarCoins, filters, reserve),
			});
		} catch {
			self.postMessage({ cashFree, error: "Could not calculate gathering. Try again." });
		}
		return;
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
