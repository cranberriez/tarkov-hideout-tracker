import assert from "node:assert/strict";
import test from "node:test";
import { parsePriceOverrides, priceOverridesKey, updatePriceOverride } from "./useManualPriceOverrides";

test("empty values extend existing saves without changing buy/sell or other items", () => {
	const old = '{"can":{"buy":190000,"sell":22000,"sellSource":"trader"},"other":{"buy":13}}';
	const saved = updatePriceOverride(old, "can", { ...parsePriceOverrides(old).can, emptyValue: 45000 });
	assert.deepEqual(parsePriceOverrides(saved), {
		can: { buy: 190000, sell: 22000, sellSource: "trader", emptyValue: 45000 },
		other: { buy: 13 },
	});
	const edited = updatePriceOverride(saved, "can", { buy: 180000 });
	assert.deepEqual(parsePriceOverrides(edited).can, { buy: 180000, emptyValue: 45000 });
	const resetBuy = updatePriceOverride(edited, "can", {});
	assert.deepEqual(parsePriceOverrides(resetBuy).can, { emptyValue: 45000 });
	const resetEmpty = updatePriceOverride(saved, "can", { ...parsePriceOverrides(saved).can, emptyValue: undefined });
	assert.deepEqual(parsePriceOverrides(resetEmpty), parsePriceOverrides(old));
});

test("zero is saved, invalid empty values cannot destroy existing prices, empty-only reset removes its entry", () => {
	const saved = updatePriceOverride(null, "can", { emptyValue: 0 });
	assert.equal(parsePriceOverrides(saved).can.emptyValue, 0);
	assert.deepEqual(parsePriceOverrides(updatePriceOverride(saved, "can", { emptyValue: undefined })), {});
	for (const emptyValue of [-1, "12", null]) {
		assert.deepEqual(parsePriceOverrides(JSON.stringify({ can: { buy: 20, emptyValue } })), { can: { buy: 20 } });
	}
	assert.deepEqual(parsePriceOverrides("invalid"), {});
});

test("profile keys remain unchanged and values survive reload and mode switches independently", () => {
	const storage = new Map<string, string>();
	for (const [mode, price] of [
		["PVP", 10000],
		["PVE", 20000],
		["KORD", 0],
	] as const) {
		assert.equal(priceOverridesKey(mode), `tarkov-profit-price-overrides-v1:${mode}`);
		storage.set(priceOverridesKey(mode), updatePriceOverride(null, "can", { emptyValue: price }));
	}
	for (const [mode, price] of [
		["KORD", 0],
		["PVP", 10000],
		["PVE", 20000],
	] as const) {
		assert.equal(parsePriceOverrides(storage.get(priceOverridesKey(mode))!).can.emptyValue, price);
	}
});
