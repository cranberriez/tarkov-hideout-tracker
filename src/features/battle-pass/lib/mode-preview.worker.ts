import { cashFreeGatheringPlan, type GatheringFilters, type SavingsRoute } from "./gathering-savings-model";

/** Fastest cash-free finish (days) for each preferred-mode route, or null when none exists.
 * Each search repeats many funding solves, so it runs off the page thread. */
self.onmessage = (
	event: MessageEvent<{
		routes: SavingsRoute[];
		startingTarCoins: number;
		filters: GatheringFilters;
		reserve: number;
	}>,
) => {
	const { routes, startingTarCoins, filters, reserve } = event.data;
	self.postMessage(
		routes.map((route) => {
			try {
				return cashFreeGatheringPlan(route, startingTarCoins, filters, reserve)?.days ?? null;
			} catch {
				return null;
			}
		}),
	);
};
