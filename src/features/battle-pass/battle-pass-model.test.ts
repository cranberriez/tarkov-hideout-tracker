import assert from "node:assert/strict";
import test from "node:test";
import {
	coverCosts,
	documents,
	pages,
	parseProgress,
	planGoals,
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
	assert.deepEqual(parseProgress("invalid"), { completed: [], goals: [], inventory: {}, classified: 0 });
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
