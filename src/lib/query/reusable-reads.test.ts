import assert from "node:assert/strict";
import test from "node:test";
import { completedItemsConversionQueryOptions, legacyProfileConversionQueryOptions } from "./conversions";

test("conversion reads are cached independently for each requested destination mode", () => {
	assert.deepEqual(legacyProfileConversionQueryOptions("regular").queryKey, [
		"conversion",
		"legacy-profile",
		"regular",
	]);
	assert.deepEqual(completedItemsConversionQueryOptions("pve").queryKey, ["conversion", "completed-items", "pve"]);
	assert.notDeepEqual(
		legacyProfileConversionQueryOptions("regular").queryKey,
		legacyProfileConversionQueryOptions("pve").queryKey,
	);
});
