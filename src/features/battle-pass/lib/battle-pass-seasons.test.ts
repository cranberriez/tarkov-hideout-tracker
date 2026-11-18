import assert from "node:assert/strict";
import test from "node:test";
import { getBattlePassData } from "../../../lib/battle-pass-seasons";
import { profileDocumentCounts } from "./battle-pass-inventory";
import { planGoals, unlockedPages, coverCosts } from "./battle-pass-model";
import { battlePassPageHref } from "./battle-pass-page-link";
test("season registries retain Season 1 IDs/key and independently own placeholder metadata", () => {
	const one = getBattlePassData("season-1"),
		two = getBattlePassData("season-2");
	assert.equal(one.storageKey, "tarkov-battle-pass-season-1-v1");
	assert.equal(two.storageKey, "tarkov-battle-pass-season-2-v1");
	assert.ok(two.placeholder);
	assert.ok(two.notice?.includes("placeholder"));
	assert.ok(one.tiles.every((tile) => tile.id.startsWith("season-1-")));
	assert.ok(two.tiles.every((tile) => tile.id.startsWith("season-2-")));
	assert.deepEqual(one.documentItemIds, two.documentItemIds);
	for (const key of ["pages", "documents", "locations", "documentLocationArtwork"] as const)
		assert.notEqual(one[key], two[key]);
});
test("planning and completion cannot recognize another season's reward IDs", () => {
	const one = getBattlePassData("season-1"),
		two = getBattlePassData("season-2");
	const old = one.tiles[0].id,
		fresh = two.tiles[0].id;
	const plan = planGoals([fresh, old], [old], two.pages);
	assert.deepEqual(plan.unresolvedIds, [old]);
	assert.ok(plan.selected.some((tile) => tile.id === fresh));
	assert.equal(unlockedPages([old], two.pages)[1], false);
});
test("selected document mapping controls inventory totals", () => {
	const two = getBattlePassData("season-2");
	const mapping = { ...two.documentItemIds, financial: "test-financial" };
	const counts = { "test-financial": { have: 20, haveFir: 5 } };
	assert.equal(profileDocumentCounts(counts, mapping).financial, 25);
	assert.equal(coverCosts({ different: 5 }, {}, 0, false, [], ["different"]).missing, 5);
});
test("page links carry the season and page anchor", () => {
	assert.equal(battlePassPageHref(2, "season-2"), "/battle-pass?page=2&season=season-2#pass-page-2");
});
