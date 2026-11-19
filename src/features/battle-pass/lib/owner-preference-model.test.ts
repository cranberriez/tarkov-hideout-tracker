import assert from "node:assert/strict";
import test from "node:test";
import loadHighs from "highs";
import type { Costs, Tile } from "./battle-pass-model";
import { buildDocumentRouteModel, interpretDocumentRoute } from "./document-route-model";
import { balanceOwners, preferOwners } from "./owner-preference-model";
import { gatheringScenario, parallelDays } from "./gathering-savings-model";

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

test("owner moves keep the claim order and never need classified earlier or in larger amounts", async () => {
	const request = buildDocumentRouteModel({
		pages: [
			{ num: 1, req: 0, cells: [tile("x", { a: 2 }), tile("y", { a: 3 }), tile("z", { b: 1 })] },
			{ num: 2, req: 2, cells: [tile("goal", { a: 1, c: 4 })] },
		],
		profiles: [
			{ key: "P0", label: "P0", inventory: { a: 5, b: 1 } },
			{ key: "P1", label: "P1", inventory: { a: 1, b: 1, c: 1 } },
		],
		completedIds: [],
		goalIds: ["x", "y", "z", "goal"],
		finishSeason: false,
		buyAll: false,
		classified: 2,
		useClassified: true,
	});
	const solved = (await loadHighs()).solve(request.model!, { output_flag: false, mip_rel_gap: 0 });
	assert.equal(solved.Status, "Optimal");
	const route = interpretDocumentRoute(request, solved.Columns);
	for (const preferred of ["P0", "P1"]) {
		const moved = preferOwners(request, route, (key) => (key === preferred ? 0 : 1));
		assert.deepEqual(
			moved.claims.map((claim) => claim.rewardId),
			route.claims.map((claim) => claim.rewardId),
		);
		assert.ok(moved.possibleNow >= route.possibleNow);
		let before = 0,
			after = 0;
		route.claims.forEach((claim, index) => {
			before += claim.additionalClassified;
			after += moved.claims[index].additionalClassified;
			assert.ok(after <= before, `claim ${claim.rewardId} needs classified earlier`);
		});
	}
	// The free move happens: z costs P1 nothing extra.
	const toP1 = preferOwners(request, route, (key) => (key === "P1" ? 0 : 1));
	assert.equal(toP1.claims.find((claim) => claim.rewardId === "z")?.profileKey, "P1");
	assert.ok(
		toP1.claims.some((claim) => claim.profileKey === "P0"),
		"costly moves stay with P0",
	);
});

test("balanced owners shorten the slowest mode's gathering without costing more", async () => {
	const request = buildDocumentRouteModel({
		pages: [{ num: 1, req: 0, cells: [1, 2, 3, 4, 5, 6].map((n) => tile(`r${n}`, { a: 10 })) }],
		profiles: [
			{ key: "PVE", label: "PVE", inventory: {} },
			{ key: "PVP", label: "PVP", inventory: {} },
		],
		completedIds: [],
		goalIds: [1, 2, 3, 4, 5, 6].map((n) => `r${n}`),
		finishSeason: false,
		buyAll: false,
		classified: 0,
		useClassified: false,
	});
	const solved = (await loadHighs()).solve(request.model!, { output_flag: false, mip_rel_gap: 0 });
	assert.equal(solved.Status, "Optimal");
	// Every claim on PVE: 60 documents at 15 a day.
	const allPve = preferOwners(request, interpretDocumentRoute(request, solved.Columns), (key) =>
		key === "PVE" ? 0 : 1,
	);
	const days = (route: typeof allPve, filters = {}) =>
		parallelDays(gatheringScenario(route, Infinity, filters).quantities);
	assert.equal(days(allPve), 4);
	const balanced = balanceOwners(request, allPve, Infinity, {});
	assert.deepEqual(
		balanced.claims.map((claim) => claim.rewardId),
		allPve.claims.map((claim) => claim.rewardId),
	);
	// Best split: 40 on PVP (2 days at 25) and 20 on PVE (2 days at 15).
	assert.equal(days(balanced), 2);
	assert.equal(balanced.additionalClassified, allPve.additionalClassified);
	// A mode with gathering off never takes claims: those documents would be bought instead.
	const off = { PVP: { disabled: true } };
	assert.deepEqual(balanceOwners(request, allPve, Infinity, off).claims, allPve.claims);
});
