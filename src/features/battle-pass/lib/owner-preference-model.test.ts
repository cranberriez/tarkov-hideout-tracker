import assert from "node:assert/strict";
import test from "node:test";
import loadHighs from "highs";
import type { Costs, Tile } from "./battle-pass-model";
import { buildDocumentRouteModel, interpretDocumentRoute } from "./document-route-model";
import { preferOwners } from "./owner-preference-model";

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
