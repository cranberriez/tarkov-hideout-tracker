import assert from "node:assert/strict";
import test from "node:test";
import {
	coverCosts,
	documents,
	pages,
	parseProgress,
	planGoals,
	previewProgress,
	tiles,
	toggleId,
	totalCost,
	unlockedPages,
	type PassPage,
	type Tile,
} from "./battle-pass-model";

const tile = (id: string, cost: number, slot: number): Tile => ({
	id,
	slot,
	displayName: id,
	img: "",
	bigImg: "",
	cost: { financial: cost },
	totalDocumentCost: cost,
	rewards: [{ type: "item" }],
});
const sample: PassPage[] = [
	{ num: 1, req: 0, cells: [tile("a", 1, 1), tile("b", 2, 2), tile("c", 9, 3)] },
	{ num: 2, req: 2, cells: [tile("d", 3, 1), tile("e", 4, 2), tile("f", 8, 3)] },
	{ num: 3, req: 2, cells: [tile("g", 5, 1)] },
];

test("goals include cheapest prerequisites once, and respect explicitly wanted expensive rewards", () => {
	const plan = planGoals(["g", "c", "g"], [], sample);
	assert.equal(plan.total, 22); // c + a, d + e, g
	assert.deepEqual(new Set(plan.fillerIds), new Set(["a", "d", "e"]));
	assert.equal(plan.selected.length, 5);
	assert.equal(planGoals(["g"], ["b", "f"], sample).total, 9); // a + d + g
	assert.equal(planGoals(["g"], ["g"], sample).total, 0);
	assert.equal(planGoals([], [], sample).total, 0);
});

test("greedy per-page choices match exhaustive minimum for every goal subset", () => {
	const all = sample.flatMap((page) => page.cells);
	for (let mask = 1; mask < 1 << all.length; mask++) {
		const goals = all.filter((_, i) => mask & (1 << i));
		const targetIndex = sample.findLastIndex((page) => page.cells.some((t) => goals.includes(t)));
		let minimum = Infinity;
		for (let choices = mask; choices < 1 << all.length; choices++) {
			if ((choices & mask) !== mask) continue;
			const selected = all.filter((_, i) => choices & (1 << i));
			if (
				sample
					.slice(0, targetIndex)
					.some((page, i) => page.cells.filter((t) => selected.includes(t)).length < sample[i + 1].req)
			)
				continue;
			minimum = Math.min(
				minimum,
				selected.reduce((sum, t) => sum + totalCost(t.cost), 0),
			);
		}
		assert.equal(
			planGoals(
				goals.map((t) => t.id),
				[],
				sample,
			).total,
			minimum,
		);
	}
});

test("unknown IDs cannot meet gates or vanish from unresolved goals", () => {
	const plan = planGoals(["g", "unknown"], ["unknown-completed"], sample);
	assert.equal(plan.total, 15);
	assert.deepEqual(plan.unresolvedIds, ["unknown"]);
});

test("inventory and classified pool are allocated once, bounded by deficits", () => {
	const result = coverCosts({ financial: 5, project: 4 }, { financial: 3, project: 1, medical: 100 }, 4, true);
	assert.equal(result.ownedUsed, 4);
	assert.equal(result.classifiedUsed, 4);
	assert.equal(result.missing, 1);
	assert.equal(result.rows.find((row) => row.key === "financial")?.classified, 2);
	assert.equal(result.rows.find((row) => row.key === "project")?.classified, 2);
	assert.equal(coverCosts({ financial: 2 }, { financial: 10 }, 50, true).classifiedUsed, 0);
	assert.equal(coverCosts({ financial: 2 }, {}, 50, true).classifiedUsed, 2);
	assert.equal(coverCosts({ financial: 2 }, {}, 50, false).missing, 2);
});

test("saved progress survives roundtrip and unknown IDs, malformed fields normalize independently", () => {
	const progress = parseProgress(
		JSON.stringify({
			completed: ["a", "a", 5, "future"],
			goals: ["g"],
			inventory: { financial: 3.8, future: 7, medical: -1 },
			classified: 4,
		}),
	);
	assert.deepEqual(progress.completed, ["a", "future"]);
	assert.deepEqual(progress.inventory, { financial: 3, future: 7, medical: 0 });
	assert.deepEqual(parseProgress(JSON.stringify(progress)), progress);
	assert.deepEqual(parseProgress("invalid"), {
		completed: [],
		goals: [],
		inventory: {},
		classified: 0,
		avoidedDocuments: [],
	});
	assert.deepEqual(toggleId(toggleId(progress.completed, "b"), "b"), progress.completed);
});

test("real dataset preserves bundle costs, source totals and sequential unlocks", () => {
	assert.equal(tiles.length, 53);
	assert.equal(new Set(tiles.map((t) => t.id)).size, 53);
	const all = planGoals(
		tiles.map((t) => t.id),
		[],
	);
	assert.equal(all.total, 501);
	for (const doc of documents) assert.equal(all.costs[doc.key], doc.total);
	const bundle = pages[11].cells[0];
	assert.equal(bundle.rewards.length, 6);
	assert.equal(bundle.totalDocumentCost, 29);
	assert.equal(
		planGoals(
			tiles.map((t) => t.id),
			[bundle.id],
		).total,
		472,
	);
	assert.deepEqual(unlockedPages([]), [true, ...Array(11).fill(false)]);
	const pageOneDone = pages[0].cells.slice(0, 4).map((t) => t.id);
	assert.equal(unlockedPages(pageOneDone)[1], true);
	assert.equal(unlockedPages(pages[1].cells.map((t) => t.id))[2], false);
});

test("collection preferences break ties without buying more expensive rewards", () => {
	const preferred = { ...tile("preferred", 2, 2), cost: { medical: 2 } };
	const expensive = { ...tile("expensive", 3, 3), cost: { medical: 3 } };
	const pass = [
		{ num: 1, req: 0, cells: [tile("cheap", 1, 0), tile("avoided", 2, 1), preferred, expensive] },
		{ num: 2, req: 2, cells: [tile("goal", 5, 0)] },
	];
	assert.deepEqual(planGoals(["goal"], [], pass).fillerIds, ["cheap", "avoided"]);
	const plan = planGoals(["goal"], [], pass, ["financial"]);
	assert.deepEqual(plan.fillerIds, ["cheap", "preferred"]);
	assert.equal(plan.total, planGoals(["goal"], [], pass).total);
	assert.ok(planGoals(["goal", "avoided"], [], pass, ["financial"]).selected.some((t) => t.id === "avoided"));
	for (const goal of tiles) {
		assert.equal(
			planGoals(
				[goal.id],
				[],
				pages,
				documents.map((d) => d.key),
			).total,
			planGoals([goal.id], []).total,
		);
	}
});

test("avoided shortages become classified demand, with owned stock and wildcards counted once", () => {
	const costs = { financial: 5, project: 4 };
	const inventory = { project: 1 };
	const off = coverCosts(costs, inventory, 2, false, ["project"]);
	assert.equal(off.classifiedMissing, 3);
	assert.equal(off.missing, 8);
	assert.equal(off.rows.find((r) => r.key === "project")?.missing, 0);
	const on = coverCosts(costs, inventory, 4, true, ["project"]);
	assert.equal(on.classifiedMissing, 0);
	assert.equal(on.classifiedUsed, 4);
	assert.equal(on.rows.find((r) => r.key === "project")?.classified, 3);
	assert.equal(on.missing, 4);
	assert.equal(coverCosts(costs, {}, 0, true, ["financial", "project"]).classifiedMissing, 9);
	assert.equal(coverCosts({}, {}, 10, true, ["financial"]).missing, 0);
});

test("old saves default to collecting everything and preferences survive reload", () => {
	assert.deepEqual(
		parseProgress(JSON.stringify({ completed: ["old"], inventory: { financial: 7 } })).avoidedDocuments,
		[],
	);
	const saved = parseProgress(
		JSON.stringify({
			completed: ["old"],
			inventory: { financial: 7 },
			avoidedDocuments: ["financial", "future", "financial", 4],
		}),
	);
	assert.deepEqual(saved.avoidedDocuments, ["financial", "future"]);
	assert.deepEqual(parseProgress(JSON.stringify(saved)), saved);
	assert.deepEqual(saved.completed, ["old"]);
	assert.equal(saved.inventory.financial, 7);
});

test("possible progress allocates stock once in page/slot order without changing inputs", () => {
	const plan = planGoals(["g"], [], sample);
	const inventory = { financial: 7 };
	const completed: string[] = [];
	const result = previewProgress([...plan.selected].reverse(), completed, inventory, 0, false, [], sample);
	assert.deepEqual(
		[...result.fractions],
		[
			["a", 1],
			["b", 1],
			["d", 1],
			["e", 0.25],
		],
	);
	assert.deepEqual(result.pageProgress, [2, 1.25, 0]);
	assert.equal(result.total, 3.25);
	assert.equal(result.allocations.get("e")?.financial, 1);
	assert.equal(result.fractions.has("g"), false);
	assert.deepEqual(inventory, { financial: 7 });
	assert.deepEqual(completed, []);
	assert.equal(previewProgress(plan.selected, [], {}, 0, false, [], sample).total, 0);
});

test("preview counts only fully covered rewards toward sequential prerequisites", () => {
	const plan = planGoals(["g"], ["b", "f"], sample);
	const result = previewProgress(plan.selected, ["b", "f", "unknown"], { financial: 9 }, 0, false, [], sample);
	assert.deepEqual(
		[...result.fractions],
		[
			["a", 1],
			["d", 1],
			["g", 1],
		],
	);
	assert.equal(result.fractions.has("b"), false);
	assert.deepEqual(result.pageProgress, [1, 1, 1]);
	const blocked = previewProgress(plan.selected, ["b", "f"], { financial: 0 }, 9, false, [], sample);
	assert.equal(blocked.total, 0);
	const laterOwned = { ...tile("later", 2, 1), cost: { medical: 2 } };
	const pass = [sample[0], { num: 2, req: 2, cells: [laterOwned] }];
	const gated = previewProgress(
		[sample[0].cells[0], sample[0].cells[1], laterOwned],
		[],
		{ financial: 2, medical: 2 },
		0,
		false,
		[],
		pass,
	);
	assert.equal(gated.fractions.get("b"), 0.5);
	assert.equal(gated.fractions.has("later"), false);
});

test("preview shares classified stock sequentially, without reserving it for later rewards", () => {
	const a = { ...tile("a", 2, 1), cost: { financial: 2 } };
	const b = { ...tile("b", 3, 2), cost: { project: 3 } };
	const pass = [{ num: 1, req: 0, cells: [a, b] }];
	const result = previewProgress([a, b], [], { financial: 1 }, 3, true, ["project"], pass);
	assert.deepEqual(
		[...result.fractions],
		[
			["a", 1],
			["b", 2 / 3],
		],
	);
	assert.equal(result.total, 1 + 2 / 3);
	assert.equal(previewProgress([a, b], [], { financial: 1 }, 3, false, ["project"], pass).total, 0.5);
	assert.equal(previewProgress([a, b], ["b"], { financial: 1 }, 3, true, ["project"], pass).total, 1);
	const first = { ...a, cost: { project: 2 } };
	const later = { ...b, cost: { financial: 3 } };
	const sequential = previewProgress(
		[first, later],
		[],
		{},
		2,
		true,
		["financial"],
		[
			{ num: 1, req: 0, cells: [first] },
			{ num: 2, req: 1, cells: [later] },
		],
	);
	assert.equal(sequential.fractions.get("a"), 1);
	assert.equal(sequential.fractions.has("b"), false);
});

test("preview applies wildcards to avoided shortages first within each reward", () => {
	const reward = { ...tile("a", 4, 1), cost: { financial: 2, project: 2 } };
	const result = previewProgress([reward], [], {}, 2, true, ["project"], [{ num: 1, req: 0, cells: [reward] }]);
	assert.deepEqual(result.allocations.get("a"), { project: 2, financial: 0 });
});
