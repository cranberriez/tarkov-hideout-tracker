import assert from "node:assert/strict";
import test from "node:test";
import { decideSurplus, unitSellValue } from "./decision-model";
import { inventoryBeforeSends, planUploaderInventory } from "./inventory-model";
import type { SummaryRow } from "./summary-model";

const now = 1_800_000_000_000;
const price = {
	price: 100,
	fleaStability: "stable" as const,
	updatedAt: now,
	marketReference: { typical: 100, rangeLow: 80, rangeHigh: 130, calculatedAt: now },
	sellFor: [{ traderId: "t", priceRUB: 120 }],
};

test("surplus sells by default and holds only when a reliable price is below its usual range", () => {
	assert.equal(decideSurplus(price, "ready", now).action, "SELL");
	assert.equal(decideSurplus({ ...price, price: 140 }, "ready", now).action, "SELL");
	assert.equal(decideSurplus({ ...price, price: 70 }, "ready", now).action, "HOLD");
	for (const unreliable of [
		{ ...price, price: 70, fleaStability: "unstable" as const },
		{ ...price, price: 70, updatedAt: now - 73 * 3_600_000 },
		{ ...price, price: 70, marketReference: undefined },
	])
		assert.equal(decideSurplus(unreliable, "ready", now).action, "SELL");
	assert.equal(decideSurplus(price, "pending", now).pending, true);
	assert.equal(decideSurplus(undefined, "error", now).action, "SELL");
	assert.equal(unitSellValue(price), 120);
});

test("inventory sends add once per scan, keep FIR separate, and block unknown FIR", () => {
	const row: SummaryRow = {
		item: { id: "a", name: "A", normalizedName: "a" },
		category: "keep",
		quantity: 2,
		foundInRaid: "yes",
	};
	const rows = [row, { ...row, category: "surplus" as const, foundInRaid: "no" as const, quantity: 3 }];
	const kept = planUploaderInventory(rows, {}, true);
	assert.deepEqual(kept.deltas, [{ itemId: "a", have: 0, haveFir: 2 }]);
	const sent = { a: { have: 0, haveFir: 2 } };
	assert.deepEqual(planUploaderInventory(rows, sent, false).deltas, [{ itemId: "a", have: 3, haveFir: 0 }]);
	assert.deepEqual(planUploaderInventory(rows, sent, true).deltas, []);
	assert.equal(planUploaderInventory([{ ...row, foundInRaid: "unknown" }], {}, false).unknown, 2);
	assert.deepEqual(inventoryBeforeSends({ a: { have: 1, haveFir: 5 } }, sent), { a: { have: 1, haveFir: 3 } });
});
