import assert from "node:assert/strict";
import test from "node:test";
import type { AcquisitionPlan } from "../../../lib/price-calculation/types";
import { ingredientSourceOptions } from "./station-craft-details-model";

function plan(cost: number | null, alternatives: number[] = []): AcquisitionPlan {
	return {
		itemId: "water",
		quantity: 1,
		method: cost === null ? "unavailable" : "trader",
		sourceId: "therapist",
		batches: 1,
		totalCost: cost,
		theoreticalCost: cost,
		theoreticalMethod: "trader",
		directBuyCost: cost,
		directBuyMethod: "trader",
		durationSeconds: 0,
		children: [],
		alternatives: alternatives.map((price, index) => ({
			method: "flea",
			sourceId: `source-${index}`,
			totalCost: price,
			theoreticalCost: price,
			batches: 1,
			durationSeconds: 0,
			children: [],
		})),
	};
}

test("nearby ingredient prices are inline and distant sources remain in the menu", () => {
	const result = ingredientSourceOptions(plan(15_530, [16_500, 21_000]));
	assert.deepEqual(
		result.inline.map((route) => route.totalCost),
		[16_500],
	);
	assert.equal(result.routes.length, 3);
	assert.equal(result.hasMore, true);
});

test("choosing an expensive source does not promote every expensive alternative inline", () => {
	const result = ingredientSourceOptions(plan(50_000, [10_000, 11_000, 40_000]));
	assert.deepEqual(
		result.inline.map((route) => route.totalCost),
		[10_000, 11_000],
	);
	assert.equal(result.hasMore, true);
});

test("single, free, and unavailable sources do not invent comparable prices", () => {
	assert.deepEqual(ingredientSourceOptions(plan(15_530)).inline, []);
	assert.equal(ingredientSourceOptions(plan(15_530)).hasMore, false);
	assert.deepEqual(
		ingredientSourceOptions(plan(0, [0, 1])).inline.map((route) => route.totalCost),
		[0],
	);
	assert.deepEqual(ingredientSourceOptions(plan(null)), { routes: [], inline: [], hasMore: false });
});
