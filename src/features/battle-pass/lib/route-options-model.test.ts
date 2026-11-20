import test from "node:test";
import assert from "node:assert/strict";
import { optimizeRouteFunding } from "./funding-model";
import { gatheringScenario, type SavingsRoute } from "./gathering-savings-model";
import { priceRoutes } from "./route-options-model";

function route(cost: number, coins: number): SavingsRoute {
	const claim = {
		rewardId: "0",
		profileKey: "PVP",
		profileLabel: "PVP",
		page: 1,
		cost: { financial: cost },
		ordinaryUsed: { financial: 0 },
		classifiedUsed: 0,
		additionalClassified: cost,
		possibleNow: false,
	};
	return {
		claims: [claim],
		selected: [
			{
				id: "0",
				slot: 0,
				displayName: "0",
				img: "",
				bigImg: "",
				cost: claim.cost,
				totalDocumentCost: cost,
				rewards: [{ type: "tarcoin", value: coins }],
			},
		],
		additionalClassified: cost,
		classifiedUsed: 0,
		stock: {},
		unresolvedIds: [],
		possibleNow: 0,
	} as unknown as SavingsRoute;
}

test("route options are priced at the gathering target, matching Route funding", () => {
	const routes = [route(60, 0)];
	const target = 40;
	const { options, suggestedIndex } = priceRoutes(routes, target, {}, Infinity, 0, true);
	const expected = optimizeRouteFunding(gatheringScenario(routes[0], target).claims, 0, true);
	const ungathered = optimizeRouteFunding(gatheringScenario(routes[0], 0).claims, 0, true);
	assert.equal(suggestedIndex, 0);
	assert.equal(options[0].cashCents, expected.cashCents);
	assert.equal(options[0].tarCoinsLeft, expected.balanceTarCoins);
	assert.equal(options[0].gathered, target);
	assert.ok(options[0].cashCents < ungathered.cashCents);
});
