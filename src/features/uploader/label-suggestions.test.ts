import assert from "node:assert/strict";
import test from "node:test";
import { buildLabelIndex } from "./recognition-model";
import { suggestLabelCandidates } from "./label-suggestions";
import { seedReviewBoxes, finishReview } from "./review-model";

const items = [
	{ id: "btc", name: "Physical Bitcoin", normalizedName: "bitcoin", shortName: "0.2BTC" },
	{ id: "filter", name: "Power filter", normalizedName: "power-filter", shortName: "PFilter" },
];
test("noisy Bitcoin and filter labels suggest the catalog identity without assigning it", () => {
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
		assert.equal(boxes[0].itemId, null);
		assert.equal(finishReview(boxes, items), null);
	}
});
test("short noise and unrelated text do not produce guesses", () => {
	for (const text of ["ab", "???", "unrelatedxyz"])
		assert.deepEqual(suggestLabelCandidates(text, buildLabelIndex(items)), []);
});
