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
	if (!request.model) return interpretDocumentRoute(request, {});
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

test("invalid optional costs cannot corrupt or satisfy a route", async () => {
	const r = await route(
		[
			{ num: 1, req: 0, cells: [tile("invalid", { a: NaN }), tile("valid", { a: 1 })] },
			{ num: 2, req: 1, cells: [tile("goal", { a: 1 })] },
		],
		[{ a: 2 }],
		["goal"],
		{ invalidRewardIds: ["invalid"] },
	);
	assert.deepEqual(
		r.claims.map((claim) => claim.rewardId),
		["valid", "goal"],
	);
});

test("manually completed distant goals require no earlier fillers", async () => {
	const r = await route(
		[
			{ num: 1, req: 0, cells: [tile("filler", { a: 1 })] },
			{ num: 2, req: 1, cells: [tile("goal", { a: 1 })] },
		],
		[{}],
		["goal"],
		{ completedIds: ["goal"] },
	);
	assert.deepEqual(r.claims, []);
});

test("equal document routes prefer earned TarCoins", async () => {
	const r = await route(
		[
			{
				num: 1,
				req: 0,
				cells: [tile("plain", { a: 1 }), { ...tile("coins", { a: 1 }), rewards: [{ type: "tarcoin", value: 50 }] }],
			},
			{ num: 2, req: 1, cells: [tile("goal", { a: 1 })] },
		],
		[{ a: 2 }],
		["goal"],
	);
	assert.deepEqual(
		r.claims.map((claim) => claim.rewardId),
		["coins", "goal"],
	);
});
test("a claim cannot pool ordinary documents across profiles", async () => {
	const r = await route([{ num: 1, req: 0, cells: [tile("goal", { a: 2, b: 2 })] }], [{ a: 2 }, { b: 2 }], ["goal"]);
	assert.equal(r.additionalClassified, 2);
	assert.equal(r.possibleNow, 0);
});

test("most rewards now skips an expensive reward and continues through an open gate", async () => {
	const r = await route(
		[
			{ num: 1, req: 0, cells: [tile("gate", { a: 1 }), tile("expensive", { a: 50 })] },
			{ num: 2, req: 1, cells: [tile("next", { a: 1 })] },
		],
		[{ a: 2 }],
		[],
		{ mostRewardsNow: true },
	);
	assert.deepEqual(
		r.claims.map((claim) => claim.rewardId),
		["gate", "next"],
	);
	assert.equal(r.possibleNow, 2);
	assert.equal(r.additionalClassified, 0);
});

test("most rewards now uses owned classified when it increases the reachable count", async () => {
	const r = await route(
		[{ num: 1, req: 0, cells: [tile("ordinary", { a: 1 }), tile("wildcard", { b: 1 })] }],
		[{ a: 1 }],
		[],
		{ mostRewardsNow: true, classified: 1, useClassified: true },
	);
	assert.equal(r.possibleNow, 2);
	assert.equal(r.classifiedUsed, 1);
	assert.equal(r.additionalClassified, 0);
});

test("claim order preserves accessible rewards and consumes profile stock before shared classified", () => {
	const p = [
		{
			num: 1,
			req: 0,
			cells: [
				tile("free", { a: 1 }),
				{ ...tile("coins", { a: 3, b: 3 }), rewards: [{ type: "tarcoin", value: 50 }] },
				tile("plain", { a: 3 }),
			],
		},
		{ num: 2, req: 1, cells: [tile("next", { c: 1 })] },
	];
	const request = buildDocumentRouteModel({
		pages: p,
		profiles: [
			{ key: "owner", label: "Owner", inventory: { a: 3, c: 1 } },
			{ key: "other", label: "Other", inventory: { a: 99 } },
		],
		completedIds: [],
		goalIds: ["next"],
		finishSeason: false,
		buyAll: true,
		classified: 1,
		useClassified: true,
	});
	const columns = Object.fromEntries(
		Object.entries({
			s_0: 1,
			s_1: 1,
			s_2: 1,
			s_3: 1,
			x_0_0: 1,
			x_1_0: 1,
			x_2_0: 1,
			x_3_0: 1,
			u_0_0_0: 1,
			u_2_0_0: 2,
			u_3_0_0: 1,
			c_1: 1,
			m_1: 5,
			m_2: 1,
		}).map(([key, Primal]) => [key, { Primal }]),
	);
	const r = interpretDocumentRoute(request, columns);
	assert.deepEqual(
		r.claims.map((claim) => claim.rewardId),
		["free", "next", "coins", "plain"],
	);
	assert.deepEqual(r.claims[2].ordinaryUsed, { a: 2, b: 0 });
	assert.equal(r.claims[2].classifiedUsed, 1);
	assert.equal(r.claims[2].additionalClassified, 3);
	assert.equal(r.claims[3].additionalClassified, 3);
	assert.equal(r.possibleNow, 2);
	assert.equal(r.additionalClassified, 6);
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
