import { buildGatheringSavings, type GatheringFilters, type SavingsRoute } from "./gathering-savings-model";

self.onmessage = (
	event: MessageEvent<{
		route: SavingsRoute;
		startingTarCoins: number;
		allowSpecial: boolean;
		filters: GatheringFilters;
		reserve: number;
	}>,
) => {
	try {
		const { route, startingTarCoins, allowSpecial, filters, reserve } = event.data;
		self.postMessage({ breakpoints: buildGatheringSavings(route, startingTarCoins, allowSpecial, filters, reserve) });
	} catch {
		self.postMessage({ error: "Could not calculate gathering savings. Try again." });
	}
};
