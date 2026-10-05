import assert from "node:assert/strict";
import test from "node:test";
import { decideUploaderRow } from "./decision-model";
import { planUploaderInventory } from "./inventory-model";
import type { SummaryRow } from "./summary-model";
const row: SummaryRow = {
	item: { id: "a", name: "A", normalizedName: "a" },
	category: "pricing",
	quantity: 3,
	foundInRaid: "yes",
	reasons: [],
};
const now = 1_800_000_000_000;
const price = { price: 100, fleaStability: "stable" as const, updatedAt: now, changeLast48hPercent: -10 };
test("required items stay KEEP regardless of a falling price", () => {
	for (const category of ["save", "needed"] as const)
		assert.equal(decideUploaderRow({ ...row, category }, price, "ready", false, now).action, "KEEP");
});
test("surplus sells only with a reliable declining trend", () => {
	assert.equal(decideUploaderRow(row, price, "ready", false, now).action, "SELL");
	for (const change of [10, 0, -4.9])
		assert.equal(
			decideUploaderRow(row, { ...price, changeLast48hPercent: change }, "ready", false, now).action,
			"HOLD",
		);
	for (const state of ["pending", "error"])
		assert.equal(decideUploaderRow(row, price, state, false, now).action, "HOLD");
	assert.equal(decideUploaderRow(row, price, "ready", true, now).action, "HOLD");
	assert.equal(decideUploaderRow(row, { ...price, updatedAt: now - 73 * 3600000 }, "ready", false, now).action, "HOLD");
	assert.equal(decideUploaderRow(row, { ...price, fleaStability: "unstable" }, "ready", false, now).action, "HOLD");
});
test("inventory sends preserve FIR separation, higher counts, signed unrelated counts, and repeat safely", () => {
	const rows = [
		{ ...row, category: "save" as const },
		{ ...row, foundInRaid: "no" as const, quantity: 2 },
	];
	const required = planUploaderInventory(rows, { a: { have: -2, haveFir: 1 } }, true);
	assert.deepEqual(required.deltas, [{ itemId: "a", have: 0, haveFir: 2 }]);
	const all = planUploaderInventory(rows, { a: { have: 8, haveFir: 3 } }, false);
	assert.deepEqual(all.deltas, []);
	assert.equal(planUploaderInventory([{ ...row, foundInRaid: "unknown" }], {}, false).unknown, 3);
});
