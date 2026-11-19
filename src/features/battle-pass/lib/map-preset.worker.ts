import { fewestMaps, type FewestMapsInput } from "./map-filter-model";

/** The "fewest maps" search prices up to one gathering scenario per distinct
 * document coverage, so it runs off the page thread. */
self.onmessage = (event: MessageEvent<FewestMapsInput>) => {
	try {
		self.postMessage({ result: fewestMaps(event.data) });
	} catch {
		self.postMessage({ error: "Could not search map sets. Try again." });
	}
};
