import { buildGatheringSavings, type SavingsRoute } from "./gathering-savings-model";

self.onmessage = (event: MessageEvent<{ route: SavingsRoute; startingTarCoins: number; allowSpecial: boolean }>) => {
	try {
		const { route, startingTarCoins, allowSpecial } = event.data;
		self.postMessage({ breakpoints: buildGatheringSavings(route, startingTarCoins, allowSpecial) });
	} catch {
		self.postMessage({ error: "Could not calculate gathering savings. Try again." });
	}
};
