import assert from "node:assert/strict";
import test from "node:test";
import { getBattlePassData } from "../../../lib/battle-pass-seasons";
import { selectGoalRewards } from "./battle-pass-model";
import {
	configuredPlan,
	defaultConfiguration,
	defaultsEnabled,
	setDefaultsEnabled,
	hasCustomConfiguration,
	mergeConfiguration,
	parseConfiguration,
	rewardCostStatus,
	resizeRewardCost,
	rewardEntries,
	rewardTypeCount,
} from "./battle-pass-configuration";

const data = getBattlePassData("season-1");
const first = data.tiles[0];
const entries = (tile: typeof first) =>
	Object.entries(tile.cost).map(([key, amount]) => ({ key, quantity: String(amount) }));

test("saved document slot order survives reload and display derivation", () => {
	const tile = data.pages[3].cells[1];
	const ordered = entries(tile).reverse();
	const saved = parseConfiguration(mergeConfiguration(null, {}, { [tile.id]: ordered }));
	const status = rewardCostStatus(tile, saved[tile.id], data.documentKeys);
	assert.equal(status.valid, true);
	assert.deepEqual(
		Object.keys(status.displayCosts),
		ordered.map((entry) => entry.key),
	);
	assert.deepEqual(
		Object.keys(status.costs!),
		ordered.map((entry) => entry.key),
	);
});

test("partial page-four entries remain displayable without becoming verified costs", () => {
	const tile = data.pages[3].cells[1];
	const partial = entries(tile).slice(0, -1);
	const saved = parseConfiguration(mergeConfiguration(null, {}, { [tile.id]: partial }));
	const status = rewardCostStatus(tile, saved[tile.id], data.documentKeys);
	assert.equal(status.valid, false);
	assert.equal(status.costs, null);
	assert.equal(status.hasEntries, true);
	assert.deepEqual(
		status.displayCosts,
		Object.fromEntries(partial.map(({ key, quantity }) => [key, Number(quantity)])),
	);
	assert.equal(configuredPlan([tile], saved, data.documentKeys).costs, null);
	assert.deepEqual(saved[tile.id], partial);
});

test("displayed saved costs omit invalid inputs and retain duplicate validation", () => {
	const status = rewardCostStatus(
		first,
		[
			{ key: "financial", quantity: "2" },
			{ key: "financial", quantity: "3" },
			{ key: "medical", quantity: "" },
			{ key: "user", quantity: "0" },
			{ key: "unknown", quantity: "4" },
		],
		data.documentKeys,
	);
	assert.deepEqual(status.displayCosts, { financial: 5 });
	assert.equal(status.costs, null);
	assert.ok(status.errors.includes("Duplicate document types"));
	assert.equal(rewardCostStatus(first, undefined, data.documentKeys).hasEntries, false);
	assert.deepEqual(rewardCostStatus(first, undefined, data.documentKeys).displayCosts, {});
});

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

test("partial entries stay quiet while duplicate types and exceeding the total produce errors", () => {
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

test("type count overrides roundtrip and govern verified plans without changing totals", () => {
	const tile = data.pages.at(-1)!.cells[0];
	assert.equal(Object.keys(tile.cost).length, 1);
	const override = resizeRewardCost(undefined, 5);
	const quantities = [tile.totalDocumentCost - 4, 1, 1, 1, 1];
	const cost = {
		...(!Array.isArray(override) ? override : { typeCount: 5 }),
		entries: data.documentKeys.slice(0, 5).map((key, i) => ({ key, quantity: String(quantities[i]) })),
	};
	const saved = parseConfiguration(mergeConfiguration(null, {}, { [tile.id]: cost }));
	assert.equal(rewardTypeCount(tile, saved[tile.id]), 5);
	assert.equal(rewardCostStatus(tile, saved[tile.id], data.documentKeys).valid, true);
	assert.equal(configuredPlan([tile], saved, data.documentKeys).ready, true);
	assert.equal(rewardCostStatus(tile, cost.entries, data.documentKeys).valid, false);
	assert.equal(rewardCostStatus(tile, { ...cost, entries: cost.entries.slice(0, 4) }, data.documentKeys).valid, false);
	assert.equal(
		rewardCostStatus(tile, { ...cost, entries: cost.entries.map((e) => ({ ...e, quantity: "1" })) }, data.documentKeys)
			.valid,
		false,
	);
});

test("resizing retains leading entries and saves an empty overridden slot count", () => {
	const original = entries(data.pages.at(-1)!.cells[1]);
	const grown = resizeRewardCost(original, original.length + 1);
	assert.deepEqual(rewardEntries(grown)?.slice(0, original.length), original);
	assert.deepEqual(rewardEntries(grown)?.at(-1), { key: "", quantity: "" });
	assert.deepEqual(rewardEntries(resizeRewardCost(grown, 1)), original.slice(0, 1));
	const empty = resizeRewardCost(undefined, 10);
	const saved = parseConfiguration(mergeConfiguration(null, {}, { [first.id]: empty }));
	assert.equal(rewardTypeCount(first, saved[first.id]), 10);
	assert.equal(rewardCostStatus(first, saved[first.id], data.documentKeys).valid, false);
	for (const count of [0, 11, -1, 1.5, NaN]) assert.throws(() => resizeRewardCost(undefined, count));
	for (const typeCount of [0, 11, 1.5, "5", null]) {
		const parsed = parseConfiguration(JSON.stringify({ rewards: { [first.id]: { entries: [], typeCount } } }));
		assert.equal(rewardTypeCount(first, parsed[first.id]), Object.keys(first.cost).length);
	}
});

test("type count edits preserve unrelated saves and reject concurrent edits to the same reward", () => {
	const baseline = { [first.id]: entries(first) };
	const draft = { [first.id]: resizeRewardCost(baseline[first.id], 2) };
	const raw = JSON.stringify({ version: 1, extra: true, rewards: { ...baseline, unknown: { future: true } } });
	const saved = mergeConfiguration(raw, baseline, draft);
	assert.equal(JSON.parse(saved).extra, true);
	assert.deepEqual(JSON.parse(saved).rewards.unknown, { future: true });
	assert.throws(
		() => mergeConfiguration(saved, baseline, { [first.id]: resizeRewardCost(undefined, 3) }),
		/another tab/,
	);
	assert.equal(rewardTypeCount(first, parseConfiguration(raw)[first.id]), Object.keys(first.cost).length);
});

test("default source toggle preserves custom costs, partial inputs, type counts and unknown records", () => {
	const custom = { [first.id]: resizeRewardCost([{ key: "medical", quantity: "" }], 5) };
	const raw = JSON.stringify({ version: 1, future: true, rewards: { ...custom, unknown: { future: "keep" } } });
	assert.equal(defaultsEnabled(raw), false);
	assert.equal(defaultsEnabled(null), false);
	assert.equal(defaultsEnabled('{"useDefaults":"true"}'), false);
	const enabled = setDefaultsEnabled(raw, true);
	assert.equal(defaultsEnabled(enabled), true);
	assert.deepEqual(parseConfiguration(enabled), custom);
	assert.deepEqual(JSON.parse(enabled).rewards, JSON.parse(raw).rewards);
	assert.equal(JSON.parse(enabled).future, true);
	const restored = setDefaultsEnabled(enabled, false);
	assert.equal(defaultsEnabled(restored), false);
	assert.deepEqual(parseConfiguration(restored), custom);
	assert.deepEqual(JSON.parse(restored).rewards, JSON.parse(raw).rewards);
	// Saving custom edits while defaults are active preserves the source flag until explicitly switched.
	const baseline = parseConfiguration(enabled);
	const edited = mergeConfiguration(enabled, baseline, { ...baseline, [first.id]: entries(first) });
	assert.equal(defaultsEnabled(edited), true);
	assert.deepEqual(parseConfiguration(setDefaultsEnabled(edited, false))[first.id], entries(first));
});

test("defaults configure the selected season without becoming saved custom entries", () => {
	for (const seasonId of ["season-1", "season-2"] as const) {
		const season = getBattlePassData(seasonId);
		const defaults = defaultConfiguration(season.tiles);
		assert.equal(configuredPlan(season.tiles, defaults, season.documentKeys).ready, true);
		for (const reward of season.tiles) assert.deepEqual(defaults[reward.id], entries(reward));
	}
	const enabled = setDefaultsEnabled(null, true);
	assert.deepEqual(parseConfiguration(enabled), {});
	assert.deepEqual(parseConfiguration(setDefaultsEnabled(enabled, false)), {});
});

test("confirmation detection includes partial costs and custom counts, but excludes empty and unknown records", () => {
	assert.equal(hasCustomConfiguration({}, data.tiles), false);
	assert.equal(hasCustomConfiguration({ [first.id]: [{ key: "", quantity: "" }] }, data.tiles), false);
	assert.equal(hasCustomConfiguration({ unknown: entries(first) }, data.tiles), false);
	assert.equal(hasCustomConfiguration({ [first.id]: entries(first) }, data.tiles), true);
	assert.equal(hasCustomConfiguration({ [first.id]: [{ key: "medical", quantity: "" }] }, data.tiles), true);
	assert.equal(hasCustomConfiguration({ [first.id]: resizeRewardCost(undefined, 5) }, data.tiles), true);
});

test("too few documents appears only when every required slot has a type and number", () => {
	const tile = data.pages.at(-1)!.cells[0];
	const cost = [{ key: "financial", quantity: "1" }];
	assert.deepEqual(rewardCostStatus(tile, cost, data.documentKeys).errors, ["Too few documents"]);
	assert.deepEqual(rewardCostStatus(tile, [{ ...cost[0], quantity: "0" }], data.documentKeys).errors, [
		"Too few documents",
	]);
	for (const partial of [undefined, [], [{ key: "", quantity: "1" }], [{ key: "financial", quantity: "" }]]) {
		assert.deepEqual(rewardCostStatus(tile, partial, data.documentKeys).errors, []);
	}
	const configured = resizeRewardCost(cost, 2);
	assert.deepEqual(rewardCostStatus(tile, configured, data.documentKeys).errors, []);
	const filled = { entries: [...cost, { key: "medical", quantity: "1" }], typeCount: 2 };
	assert.deepEqual(rewardCostStatus(tile, filled, data.documentKeys).errors, ["Too few documents"]);
	const exact = { ...filled, entries: [...cost, { key: "medical", quantity: String(tile.totalDocumentCost - 1) }] };
	assert.deepEqual(rewardCostStatus(tile, exact, data.documentKeys).errors, []);
	// Advisory errors remain savable, without altering their input quantities.
	const saved = parseConfiguration(mergeConfiguration(null, {}, { [tile.id]: filled }));
	assert.deepEqual(saved[tile.id], filled);
});
