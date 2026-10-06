import assert from "node:assert/strict";
import test from "node:test";
import { nextUnknownId, selectReviewBoxes, selectionSuggestions, supportsQuantity } from "./selection-model";
import type { ReviewBox } from "./review-model";
import type { ItemSummary } from "../../types/items";
const ids = ["a", "b", "c", "d"];
test("unknown navigation advances over assigned selections, wraps, and ends when none remain", () => {
	assert.equal(nextUnknownId(ids, ["b", "d"], "a"), "b");
	assert.equal(nextUnknownId(ids, ["d"], "b"), "d");
	assert.equal(nextUnknownId(ids, ["b"], "d"), "b");
	assert.equal(nextUnknownId(ids, [], "d"), null);
	assert.equal(nextUnknownId(ids, ["b", "d"], null), "b");
	assert.equal(nextUnknownId(ids, ["b", "d"], "b", -1), "d");
	assert.equal(nextUnknownId(ids, ["b", "d"], "d", -1), "b");
});
test("click replaces, Ctrl toggles, and Shift selects an inclusive numbered range in either direction", () => {
	assert.deepEqual(selectReviewBoxes(ids, ["a"], "a", "c", false, false), ["c"]);
	assert.deepEqual(selectReviewBoxes(ids, ["a"], "a", "c", true, false), ["a", "c"]);
	assert.deepEqual(selectReviewBoxes(ids, ["a", "c"], "a", "c", true, false), ["a"]);
	assert.deepEqual(selectReviewBoxes(ids, ["a"], "a", "c", false, true), ["a", "b", "c"]);
	assert.deepEqual(selectReviewBoxes(ids, ["d"], "d", "b", false, true), ["b", "c", "d"]);
	assert.deepEqual(selectReviewBoxes(ids, ["a"], null, "c", false, true), ["c"]);
	assert.deepEqual(selectReviewBoxes(ids, ["a"], "c", "d", true, true), ["a", "c", "d"]);
});
const item = (name: string): ItemSummary => ({ id: name, name, normalizedName: name });
test("quantity is restricted to money and GP coins", () => {
	for (const name of ["roubles", "dollars", "euros", "gp-coin"]) assert.equal(supportsQuantity(item(name)), true);
	assert.equal(supportsQuantity(item("graphics-card")), false);
	assert.equal(supportsQuantity(undefined), false);
});
test("suggestions combine selection evidence, exclude missing IDs and cap at five", () => {
	const items = Array.from({ length: 8 }, (_, i) => item(String(i)));
	const boxes = [
		{ itemId: null, candidates: items },
		{ itemId: "missing", candidates: [items[3]] },
	] as ReviewBox[];
	const result = selectionSuggestions(boxes, items);
	assert.equal(result.length, 5);
	assert.equal(result[0].id, "3");
	assert.equal(new Set(result.map((i) => i.id)).size, 5);
});

test("bulk selection skips known boxes while individual selection still allows them", () => {
	const eligible = ["a", "c"];
	assert.deepEqual(selectReviewBoxes(ids, [], null, "b", false, false, eligible), ["b"]);
	assert.deepEqual(selectReviewBoxes(ids, ["b"], "b", "c", true, false, eligible), ["c"]);
	assert.deepEqual(selectReviewBoxes(ids, ["a"], "a", "c", false, true, eligible), ["a", "c"]);
	assert.deepEqual(selectReviewBoxes(ids, ["c"], "c", "a", false, true, eligible), ["a", "c"]);
	assert.deepEqual(selectReviewBoxes(ids, ["a"], "a", "b", true, false, eligible), ["a"]);
	assert.deepEqual(selectReviewBoxes(ids, ["a"], "a", "b", false, true, eligible), ["a"]);
});
