import assert from "node:assert/strict";
import test from "node:test";
import { decodeBuild, encodeBuild } from "./builder";
import { SEASON_1_MODIFIERS } from "./season-1";
import { SEASON_2_MODIFIERS } from "./season-2";

for (const set of [SEASON_1_MODIFIERS, SEASON_2_MODIFIERS]) {
	test(`${set.seasonId} share order lists every personal modifier exactly once`, () => {
		const personal = set.modifiers.filter((modifier) => modifier.kind !== "global").map((modifier) => modifier.id);
		assert.equal(new Set(set.shareOrder).size, set.shareOrder.length, "duplicate share order IDs");
		assert.deepEqual(
			personal.filter((id) => !set.shareOrder.includes(id)),
			[],
			"append new personal modifier IDs to the end of shareOrder",
		);
	});

	test(`${set.seasonId} incompatibility rules name known personal modifiers`, () => {
		const personal = new Set(set.shareOrder);
		const unknown = (set.incompatibilities?.rules ?? []).flatMap((rule) => rule.ids).filter((id) => !personal.has(id));
		assert.deepEqual(unknown, [], "typo or removed modifier in incompatibilities");
	});
}

test("compact build codes round-trip and ignore junk", () => {
	const order = SEASON_2_MODIFIERS.shareOrder;
	const picks = new Set(["lockpicker", "kappa-protocol", "unlucky"]);
	const code = encodeBuild(picks, order);
	assert.match(code, /^[A-Za-z0-9_-]+$/);
	assert.deepEqual(decodeBuild(code, order), picks);
	assert.equal(encodeBuild(new Set(), order), "");
	assert.deepEqual(decodeBuild("!!not-base64", order), new Set());
	// A code from a longer future list keeps working for the bits this list knows.
	assert.deepEqual(decodeBuild(code, order.slice(0, 1)), new Set(["lockpicker"]));
});
