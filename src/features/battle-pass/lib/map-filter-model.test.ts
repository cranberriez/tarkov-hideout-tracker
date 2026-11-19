import assert from "node:assert/strict";
import test from "node:test";
import type { SavingsRoute } from "./gathering-savings-model";
import { applyMapFilter, fewestMaps, mapExcludedTypes, previewGathering } from "./map-filter-model";

const mapNames = { a: ["Customs", "Woods"], b: ["Woods"], c: ["Reserve"] };
// One claim missing 30 of each type, owned by PVE.
const route = {
	claims: [
		{
			rewardId: "r",
			profileKey: "PVE",
			profileLabel: "PVE",
			page: 1,
			cost: { a: 30, b: 30, c: 30 },
			ordinaryUsed: {},
			classifiedUsed: 0,
			additionalClassified: 90,
			possibleNow: false,
		},
	],
	selected: [{ id: "r", rewards: [] }],
	additionalClassified: 90,
} as unknown as SavingsRoute;

test("maps exclude the document types none of them spawn, in every mode", () => {
	assert.deepEqual(mapExcludedTypes(null, mapNames), []);
	assert.deepEqual(mapExcludedTypes(["Woods"], mapNames), ["c"]);
	const filters = applyMapFilter({ PVE: { excluded: ["a"] } }, ["PVE", "PVP"], ["c"]);
	assert.deepEqual(filters, { PVE: { excluded: ["a", "c"] }, PVP: { excluded: ["c"] } });
});

test("fewest maps keeps the gathered amount and cash of every map", () => {
	const all = previewGathering(route, 40, {}, 0, false);
	assert.equal(all.gathered, 40);
	// Woods alone covers a and b (60 missing), enough for 40 at the same price.
	const best = fewestMaps({
		route,
		target: 40,
		filters: {},
		profileKeys: ["PVE"],
		maps: ["Customs", "Woods", "Reserve"],
		mapNames,
		startingTarCoins: 0,
		allowSpecial: false,
		reserve: 0,
	});
	assert.deepEqual(best.maps, ["Woods"]);
	assert.equal(best.preview.cashCents, all.cashCents);
	// Reserve alone gathers only 30.
	assert.equal(previewGathering(route, 40, applyMapFilter({}, ["PVE"], ["a", "b"]), 0, false).gathered, 30);
});
