import assert from "node:assert/strict";
import test from "node:test";
import { recipeFocusHref } from "./recipe-focus";

test("clearing recipe focus preserves unrelated URL parameters and fragment", () => {
	assert.equal(
		recipeFocusHref(
			"https://example.com/items/crafting-profits?mode=PVE&recipe=one&recipe=two&view=compact#recipes",
			null,
		),
		"/items/crafting-profits?mode=PVE&view=compact#recipes",
	);
});

test("following another linked recipe replaces focus without discarding other parameters", () => {
	assert.equal(
		recipeFocusHref("https://example.com/items/crafting-profits?view=compact&recipe=one#recipes", "two"),
		"/items/crafting-profits?view=compact&recipe=two#recipes",
	);
	assert.equal(recipeFocusHref("https://example.com/items/barter-profits", null), "/items/barter-profits");
});
