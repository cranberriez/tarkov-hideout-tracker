import test from "node:test";
import assert from "node:assert/strict";
import { calcTax, fleaTargetPrice, itemBasePrice, INTELLIGENCE_CENTER_ID } from "./calc-tax";
import { getItemBuyPrice, getItemSellComparison } from "./prices";
import type { ItemSummary } from "@/types/items";

const item: ItemSummary = {
	id: "a",
	name: "A",
	normalizedName: "a",
	marketPrice: {
		avg24hPrice: 6_000,
		sellFor: [{ vendor: { name: "Therapist", normalizedName: "therapist" }, priceRUB: 5_100 }],
	},
};
test("fee at base price, quantity scaling and final rounding", () => {
	assert.equal(calcTax(10_000, 10_000), 1_000);
	assert.equal(calcTax(10_000, 10_000, 8), 8_000);
	for (const price of [2_000, 10_000, 50_000]) {
		assert.ok(Math.abs(calcTax(10_000, price, 8)! - calcTax(10_000, price)! * 8) <= 4);
	}
	assert.equal(calcTax(10_000, 10_000, 1, { stationLevels: { "intelligence-center": 3 } }), 700);
	assert.equal(calcTax(10_000, 10_000, 1, { stationLevels: { "intelligence-center": 3 }, hideoutManagementSkillLevel: 51 }), 550);
	assert.equal(calcTax(10_000, 10_000, 1, { hideoutManagementSkillLevel: 50 }), 1_000);
	assert.equal(calcTax(10_000, 10_000, 1, { stationLevels: { [INTELLIGENCE_CENTER_ID]: 3 }, hideoutManagementSkillLevel: 50 }), 550);
	assert.equal(calcTax(10_000, 10_000, 1, { stationLevels: { [INTELLIGENCE_CENTER_ID]: 2 } }), 1_000);
});
test("base price uses trader buybacks, not purchase or flea values", () => {
	assert.equal(itemBasePrice(item.marketPrice!.sellFor), 10_000);
	assert.equal(itemBasePrice([]), null);
	assert.equal(calcTax(0, 100), null);
	assert.equal(calcTax(100, -1), null);
	assert.equal(calcTax(100, 0), 0);
});
test("net comparison can select trader over higher gross flea; purchases are unaffected", () => {
	const taxed = { ...item, marketPrice: { ...item.marketPrice, avg24hPrice: 5_500 } };
	const sale = getItemSellComparison(taxed);
	assert.equal(sale.selectedSource, "trader");
	assert.equal(sale.netTotal, 5_100);
	assert.equal(sale.fee, 0);
	assert.equal(getItemBuyPrice(taxed), 5_500);
	const flea = getItemSellComparison(item, {}, {}, 8);
	assert.equal(flea.selectedSource, "flea");
	assert.equal(flea.netTotal, 48_000 - calcTax(10_000, 6_000, 8)!);
});
test("manual price keeps its sale destination and missing base never gives free flea sales", () => {
	assert.equal(getItemSellComparison(item, { a: { sell: 20_000, sellSource: "trader" } }).fee, 0);
	assert.equal(getItemSellComparison(item, { a: { sell: 20_000, sellSource: "flea" } }).fee, calcTax(10_000, 20_000));
	const missing = { ...item, marketPrice: { avg24hPrice: 20_000 } };
	assert.equal(getItemSellComparison(missing).netTotal, null);
	assert.equal(getItemSellComparison(missing, { a: { sell: 20_000 } }).netTotal, null);
});
test("target price meets return after nonlinear fees, including unreachable targets", () => {
	const target = fleaTargetPrice(10_000, 8, 88_000)!;
	assert.ok(target > 11_000);
	assert.ok(target * 8 - calcTax(10_000, target, 8)! >= 88_000);
	assert.ok((target - 1) * 8 - calcTax(10_000, target - 1, 8)! < 88_000);
	assert.equal(fleaTargetPrice(10_000, 1, 1e15), null);
});
