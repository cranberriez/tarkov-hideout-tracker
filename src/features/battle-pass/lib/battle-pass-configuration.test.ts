import assert from "node:assert/strict";
import test from "node:test";
import { getBattlePassData } from "../../../lib/battle-pass-seasons";
import { selectGoalRewards } from "./battle-pass-model";
import { configuredPlan, mergeConfiguration, parseConfiguration, rewardCostStatus } from "./battle-pass-configuration";

const data = getBattlePassData("season-1");
const first = data.tiles[0];
const entries = (tile: typeof first) =>
	Object.entries(tile.cost).map(([key, amount]) => ({ key, quantity: String(amount) }));

test("configuration requires positive integer quantities, distinct known types and the exact total", () => {
	assert.equal(rewardCostStatus(first, undefined, data.documentKeys).valid, false);
	assert.equal(rewardCostStatus(first, entries(first), data.documentKeys).valid, true);
	for (const quantity of ["", "0", "-1", "1.5", "NaN", "1e0", "9007199254740992", "2"]) {
		assert.equal(rewardCostStatus(first, [{ key: "financial", quantity }], data.documentKeys).valid, false, quantity);
	}
	assert.equal(rewardCostStatus(first, [{ key: "unknown", quantity: "1" }], data.documentKeys).valid, false);
	const multiple = data.tiles.find((tile) => Object.keys(tile.cost).length > 1)!;
	const duplicate = entries(multiple).map((entry) => ({ ...entry, key: Object.keys(multiple.cost)[0] }));
	assert.equal(rewardCostStatus(multiple, duplicate, data.documentKeys).valid, false);
	for (const tile of data.tiles) assert.equal(rewardCostStatus(tile, entries(tile), data.documentKeys).valid, true);
});

test("only duplicate types and exceeding the total produce card errors", () => {
	assert.deepEqual(rewardCostStatus(first, undefined, data.documentKeys).errors, []);
	assert.deepEqual(rewardCostStatus(first, [{ key: "financial", quantity: "" }], data.documentKeys).errors, []);
	assert.deepEqual(rewardCostStatus(first, [{ key: "financial", quantity: "2" }], data.documentKeys).errors, [
		"Too many documents",
	]);
	assert.deepEqual(
		rewardCostStatus(first, [{ key: "financial", quantity: "9007199254740992" }], data.documentKeys).errors,
		["Too many documents"],
	);
	const multiple = data.tiles.find((tile) => Object.keys(tile.cost).length > 1)!;
	assert.deepEqual(
		rewardCostStatus(
			multiple,
			[
				{ key: "financial", quantity: "" },
				{ key: "financial", quantity: "" },
			],
			data.documentKeys,
		).errors,
		["Duplicate document types"],
	);
	assert.deepEqual(
		rewardCostStatus(
			multiple,
			[
				{ key: "financial", quantity: "999" },
				{ key: "financial", quantity: "999" },
			],
			data.documentKeys,
		).errors,
		["Duplicate document types", "Too many documents"],
	);
});

test("goals require all outstanding prerequisites and everything requires every unclaimed reward", () => {
	const goal = data.pages[1].cells[0];
	const plan = selectGoalRewards([goal.id], [], data.pages);
	const onlyGoal = { [goal.id]: entries(goal) };
	assert.equal(configuredPlan(plan.selected, onlyGoal, data.documentKeys).ready, false);
	const configuration = Object.fromEntries(plan.selected.map((tile) => [tile.id, entries(tile)]));
	assert.equal(configuredPlan(plan.selected, configuration, data.documentKeys).ready, true);
	assert.equal(configuredPlan(data.tiles, configuration, data.documentKeys).costs, null);
	const claimed = plan.fillerIds[0];
	delete configuration[claimed];
	const remaining = selectGoalRewards([goal.id], [claimed], data.pages);
	assert.equal(configuredPlan(remaining.selected, configuration, data.documentKeys).ready, true);
	assert.equal(configuredPlan([], {}, data.documentKeys, ["missing-goal"]).ready, false);
});

test("partial drafts roundtrip; merge preserves unknown records and concurrent unrelated changes", () => {
	const draft = { [first.id]: [{ key: "financial", quantity: "" }] };
	const current = JSON.stringify({
		version: 1,
		future: true,
		rewards: { unknown: { untouched: true }, other: [{ key: "test", quantity: "7" }] },
	});
	const saved = mergeConfiguration(current, {}, draft);
	assert.deepEqual(parseConfiguration(saved)[first.id], draft[first.id]);
	assert.equal(rewardCostStatus(first, parseConfiguration(saved)[first.id], data.documentKeys).costs, null);
	assert.deepEqual(JSON.parse(saved).rewards.unknown, { untouched: true });
	assert.equal(JSON.parse(saved).future, true);
	assert.deepEqual(JSON.parse(saved).rewards.other, [{ key: "test", quantity: "7" }]);
});

test("concurrent edits to the same reward are rejected and other seasons do not become configured", () => {
	const current = JSON.stringify({ rewards: { [first.id]: [{ key: "medical", quantity: "1" }] } });
	assert.throws(() => mergeConfiguration(current, {}, { [first.id]: entries(first) }), /another tab/);
	const saved = parseConfiguration(mergeConfiguration(null, {}, { [first.id]: entries(first) }));
	const second = getBattlePassData("season-2");
	assert.equal(configuredPlan([second.tiles[0]], saved, second.documentKeys).ready, false);
	assert.deepEqual(parseConfiguration(JSON.stringify({ costSwaps: { [first.id]: { financial: "medical" } } })), {});
	assert.deepEqual(parseConfiguration("broken"), {});
});
