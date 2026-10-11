import assert from "node:assert/strict";
import test from "node:test";
import { getBattlePassData } from "../../../lib/battle-pass-seasons";
import { completeInventoryTiles, inventoryProgress } from "./battle-pass-inventory";
import { emptyProgress, planGoals, unlockedPages, coverCosts } from "./battle-pass-model";
import { inventoryScopeIsCurrent, battlePassInventoryCounts } from "./battle-pass-scope";
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
	for (const key of [
		"pages",
		"documents",
		"documentMaps",
		"documentLocations",
		"locations",
		"backgrounds",
		"imagePaths",
		"documentLocationArtwork",
	] as const)
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
	const update = completeInventoryTiles(
		{ ...emptyProgress(), completed: [old] },
		{},
		[fresh],
		false,
		two.tiles,
		two.documentItemIds,
	);
	assert.deepEqual(update.progress.completed, [old, fresh]);
	assert.equal(unlockedPages([old], two.pages)[1], false);
});
test("selected document mapping controls inventory and consumption", () => {
	const two = getBattlePassData("season-2"),
		tile = two.tiles.find((tile) => tile.cost.financial)!;
	const mapping = { ...two.documentItemIds, financial: "test-financial" };
	const counts = { "test-financial": { have: 20, haveFir: 5 } };
	assert.equal(inventoryProgress(emptyProgress(), counts, mapping).inventory.financial, 25);
	const update = completeInventoryTiles(emptyProgress(), counts, [tile.id], true, two.tiles, mapping);
	assert.ok(update.changes.some((change) => change.itemId === "test-financial"));
	assert.equal(coverCosts({ different: 5 }, {}, 0, false, [], ["different"]).missing, 5);
});
test("historical inventory targets its character and stale callbacks fail closed", () => {
	const scope = { mode: "KORD", selectedSeasonId: "season-2" as const, seasonId: "season-1" as const, seasonal: true };
	const old = { a: { have: 4, haveFir: 1 } },
		active = { a: { have: 50, haveFir: 2 } };
	const state = {
		gameMode: "KORD",
		selectedSeasonId: "season-2" as const,
		itemCounts: active,
		seasonalProfiles: { "season-1": { itemCounts: old }, "season-2": { itemCounts: active } },
	};
	assert.equal(battlePassInventoryCounts(scope, state), old);
	assert.equal(inventoryScopeIsCurrent(scope, state), true);
	assert.equal(inventoryScopeIsCurrent(scope, { ...state, gameMode: "PVP" }), false);
	assert.equal(inventoryScopeIsCurrent(scope, { ...state, selectedSeasonId: "season-1" }), false);
	assert.deepEqual(
		battlePassInventoryCounts({ ...scope, seasonId: "season-2" }, { ...state, seasonalProfiles: {} }),
		{},
	);
	assert.equal(battlePassPageHref(2, "season-2"), "/battle-pass?page=2&season=season-2#pass-page-2");
});
