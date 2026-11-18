import { buildGatheringSavings, type GatheringFilters, type SavingsRoute } from "./gathering-savings-model";

self.onmessage = (
	event: MessageEvent<{
		route: SavingsRoute;
		startingTarCoins: number;
		allowSpecial: boolean;
		filters: GatheringFilters;
	}>,
) => {
	try {
		const { route, startingTarCoins, allowSpecial, filters } = event.data;
		self.postMessage({ breakpoints: buildGatheringSavings(route, startingTarCoins, allowSpecial, filters) });
	} catch {
		self.postMessage({ error: "Could not calculate gathering savings. Try again." });
	}
};
