import { fewestMaps, fewestTypes, type FewestMapsInput, type FewestTypesInput } from "./map-filter-model";

/** The "fewest maps" and "fewest document types" searches price up to one
 * gathering scenario per distinct document coverage, so they run off the page thread. */
self.onmessage = (
	event: MessageEvent<{ kind: "maps"; input: FewestMapsInput } | { kind: "types"; input: FewestTypesInput }>,
) => {
	const { data } = event;
	try {
		self.postMessage({ result: data.kind === "maps" ? fewestMaps(data.input) : fewestTypes(data.input) });
	} catch {
		self.postMessage({
			error: data.kind === "maps" ? "Could not search map sets. Try again." : "Could not search document types.",
		});
	}
};
