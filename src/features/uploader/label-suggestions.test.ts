import assert from "node:assert/strict";
import test from "node:test";
import { buildLabelIndex } from "./recognition-model";
import { suggestLabelCandidates } from "./label-suggestions";
import { seedReviewBoxes } from "./review-model";

const items = [
	{ id: "btc", name: "Physical Bitcoin", normalizedName: "bitcoin", shortName: "0.2BTC" },
	{ id: "filter", name: "Power filter", normalizedName: "power-filter", shortName: "PFilter" },
];
test("noisy Bitcoin and filter labels start assigned to their one close spelling", () => {
	const index = buildLabelIndex(items);
	for (const [text, expected] of [
		["«\\0:2BTC", "btc"],
		["8.28TC", "btc"],
		["@2BTC", "btc"],
		["_RFilter", "filter"],
		["RFilter", "filter"],
	]) {
		assert.equal(suggestLabelCandidates(text, index)[0]?.id, expected);
		const boxes = seedReviewBoxes(
			[
				{
					id: text,
					text,
					confidence: 80,
					match: "unmatched",
					candidates: [],
					bounds: { left: 0.1, top: 0.1, width: 0.1, height: 0.01 },
				},
			],
			null,
			items,
		);
		assert.equal(boxes[0].candidates[0]?.id, expected);
		assert.equal(boxes[0].itemId, expected);
	}
});
test("short noise and unrelated text do not produce guesses", () => {
	for (const text of ["ab", "???", "unrelatedxyz"])
		assert.deepEqual(suggestLabelCandidates(text, buildLabelIndex(items)), []);
});

test("truncated labels and shared short names prefer the barter item", () => {
	const catalog = [
		{ id: "paste", name: "Toothpaste", normalizedName: "toothpaste", shortName: "Toothpaste", barter: true },
		{ id: "ring", name: "Gold skull ring", normalizedName: "gold-skull-ring", shortName: "Skull", barter: true },
		{ id: "mask", name: "Spooky skull mask", normalizedName: "spooky-skull-mask", shortName: "Skull" },
	];
	const seed = (text: string, match: "exact" | "ambiguous" | "unmatched", candidates = [] as typeof catalog) =>
		seedReviewBoxes(
			[
				{
					id: text,
					text,
					confidence: 90,
					match,
					candidates,
					bounds: { left: 0.1, top: 0.1, width: 0.1, height: 0.01 },
				},
			],
			null,
			catalog,
		)[0];
	assert.equal(seed("Toothpast", "unmatched").itemId, "paste");
	const skull = seed("Skull", "ambiguous", [catalog[2], catalog[1]]);
	assert.equal(skull.itemId, "ring");
	assert.equal(skull.candidates[0].id, "ring");
});
