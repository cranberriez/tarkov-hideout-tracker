import assert from "node:assert/strict";
import test from "node:test";
import loadHighs from "highs";
import { pages, type Tile, type Costs, type PassPage } from "./battle-pass-model";
import { buildDocumentRouteModel, interpretDocumentRoute } from "./document-route-model";
const tile = (id: string, cost: Costs): Tile => ({
	id,
	cost,
	totalDocumentCost: Object.values(cost).reduce((a, b) => a + b, 0),
	slot: 0,
	displayName: id,
	img: "",
	bigImg: "",
	rewards: [],
});
async function route(pages: PassPage[], inventories: Costs[], goals: string[], extra = {}) {
	const request = buildDocumentRouteModel({
		pages,
		profiles: inventories.map((inventory, i) => ({ key: String(i), label: String(i), inventory })),
		completedIds: [],
		goalIds: goals,
		finishSeason: false,
		buyAll: false,
		classified: 0,
		useClassified: false,
		...extra,
	});
	const solver = await loadHighs();
	const result = solver.solve(request.model!, { output_flag: false, mip_rel_gap: 0 });
	assert.equal(result.Status, "Optimal");
	return interpretDocumentRoute(request, result.Columns);
}
test("inventory-aware fillers use expensive matching documents and obey gates", async () => {
	const r = await route(
		[
			{ num: 1, req: 0, cells: [tile("cheap", { a: 1 }), tile("owned", { b: 10 })] },
			{ num: 2, req: 1, cells: [tile("goal", { c: 1 })] },
		],
		[{ b: 10, c: 1 }],
		["goal"],
	);
	assert.deepEqual(
		r.claims.map((c) => c.rewardId),
		["owned", "goal"],
	);
	assert.equal(r.additionalClassified, 0);
	assert.equal(r.possibleNow, 2);
});
test("a claim cannot pool ordinary documents across profiles", async () => {
	const r = await route([{ num: 1, req: 0, cells: [tile("goal", { a: 2, b: 2 })] }], [{ a: 2 }, { b: 2 }], ["goal"]);
	assert.equal(r.additionalClassified, 2);
	assert.equal(r.possibleNow, 0);
});
test("owned classified is optional and purchased shortfall is separate", async () => {
	const p = [{ num: 1, req: 0, cells: [tile("goal", { a: 5 })] }];
	const r = await route(p, [{ a: 1 }], ["goal"], { classified: 3, useClassified: true });
	assert.equal(r.classifiedUsed, 3);
	assert.equal(r.additionalClassified, 1);
	assert.equal((await route(p, [{ a: 1 }], ["goal"], { classified: 3 })).additionalClassified, 4);
});
test("completed milestones count and later claims remain blocked", async () => {
	const p = [
		{ num: 1, req: 0, cells: [tile("done", { a: 2 }), tile("gate", { a: 2 })] },
		{ num: 2, req: 2, cells: [tile("goal", { b: 1 })] },
	];
	const r = await route(p, [{ b: 1 }], ["goal"], { completedIds: ["done"] });
	assert.equal(r.claims.length, 2);
	assert.equal(r.possibleNow, 0);
});
test("full season route solves within interactive time", async () => {
	const start = Date.now();
	const r = await route(pages, [{}, {}, {}], [], { finishSeason: true });
	assert.ok(r.claims.length > 0);
	assert.ok(Date.now() - start < 10000);
});

test("buy every reward ends at the destination slot", async () => {
	const p = [
		{
			num: 1,
			req: 0,
			cells: [
				{ ...tile("first", { a: 1 }), slot: 1 },
				{ ...tile("goal", { a: 1 }), slot: 2 },
				{ ...tile("after", { a: 1 }), slot: 3 },
			],
		},
	];
	const r = await route(p, [{ a: 3 }], ["goal"], { buyAll: true });
	assert.deepEqual(new Set(r.claims.map((c) => c.rewardId)), new Set(["first", "goal"]));
});

test("full season with distinct profile stocks remains interactive", async () => {
	const keys = [...new Set(pages.flatMap((p) => p.cells.flatMap((t) => Object.keys(t.cost))))];
	const inventories = Array.from({ length: 3 }, (_, profile) =>
		Object.fromEntries(keys.map((key, i) => [key, (i + profile) % 3 === 0 ? 75 : 0])),
	);
	const start = Date.now();
	const r = await route(pages, inventories, [], { finishSeason: true, classified: 50, useClassified: true });
	assert.ok(r.claims.length > 0);
	assert.ok(Date.now() - start < 10000);
});
