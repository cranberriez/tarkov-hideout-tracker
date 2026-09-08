import assert from "node:assert/strict";
import test from "node:test";
import { isNewItem, NEW_ITEM_WINDOW_MS } from "./new-items";

test("new items expire individually after 28 days; baseline and unknown dates stay old", () => {
	const item = { firstSeenAt: 1000, firstSeenPatch: "1.1.5.0" };
	assert.equal(isNewItem(item, 1000), true);
	assert.equal(isNewItem(item, 1000 + NEW_ITEM_WINDOW_MS - 1), true);
	assert.equal(isNewItem(item, 1000 + NEW_ITEM_WINDOW_MS), false);
	assert.equal(isNewItem(item, 999), false);
	assert.equal(isNewItem({ firstSeenAt: null, firstSeenPatch: "pre-1.1.5" }, 1000), false);
	assert.equal(isNewItem({ ...item, firstSeenPatch: "pre-1.1.5" }, 1000), false);
	for (const firstSeenAt of [undefined, null, NaN, Infinity, -1, 0]) assert.equal(isNewItem({ firstSeenAt }, 1000), false);
});
