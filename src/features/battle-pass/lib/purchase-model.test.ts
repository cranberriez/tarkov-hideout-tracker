import assert from "node:assert/strict";
import test from "node:test";
import loadHighs from "highs";
import { tiles, type Costs } from "./battle-pass-model";
import { assignedStock, purchaseModel } from "./purchase-model";

test("whole reward assignments preserve split stock and reserve the best buyer for later rewards", async () => {
	const solver = await loadHighs();
	for (const { costs, stock, expected } of [
		{ costs: [{ a: 1, b: 1 }], stock: [{ a: 1 }, { b: 1 }], expected: 1 },
		{ costs: [{ a: 1 }, { a: 1, b: 1 }], stock: [{ a: 1, b: 1 }, { a: 1 }], expected: 3 },
	]) {
		const rewards = costs.map((cost) => ({ ...tiles[0], cost: cost as Costs }));
		const inventories = stock as Costs[];
		const result = solver.solve(purchaseModel(rewards, inventories)!, { output_flag: false });
		assert.equal(result.Status, "Optimal");
		const owners = rewards.map((_, i) => inventories.findIndex((_, p) => result.Columns[`x_${i}_${p}`].Primal > 0.5));
		assert.equal(
			Object.values(assignedStock(rewards, inventories, owners)).reduce((a, b) => a + b, 0),
			expected,
		);
	}
});
