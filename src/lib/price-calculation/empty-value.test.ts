import assert from "node:assert/strict";
import test from "node:test";
import { FUEL_TANK_ITEM_IDS } from "../cfg/hideout-power";
import { createRecipeCalculator } from "./optimizer";
import { emptyIngredientPlan, getEmptySale, getEmptyValue } from "./empty-value";
import { getItemBuyPrice, getItemSellComparison } from "./prices";
import { buildStationBoard, selectedBoardCraft } from "../../features/profit-pages/optimize/station-board";
import { getPlanRecipePreview } from "../../features/profit-pages/utils/recipes";
import type { ItemSummary } from "@/types/items";
import type { BarterRecord, CraftRecord } from "@/types/recipes";

const [metal, blue] = FUEL_TANK_ITEM_IDS;
const item = (id: string, price = 100000): ItemSummary => ({
	id,
	name: id,
	normalizedName: id,
	marketPrice: { price, sellFor: [{ vendor: { name: "Trader", normalizedName: "therapist" }, priceRUB: 5100 }] },
});
const craft = (id: string, output: string, input: string): CraftRecord => ({
	id,
	productItemId: output,
	productCount: 1,
	requiredItems: [{ itemId: input, count: 2 }],
	stationId: "bench",
	level: 1,
	duration: 3600,
	requiredQuestItems: [],
	gameEditions: [],
});
const barter: BarterRecord = {
	id: "barter",
	offeredItemId: "output",
	offeredCount: 1,
	traderId: "trader",
	minTraderLevel: 1,
	requiredItems: [{ itemId: blue, count: 3 }],
};
const crafts = [craft("case", "case", metal), craft("nested", "output", "case"), craft("full", metal, "part")];
const itemsById = Object.fromEntries([metal, blue, "case", "output", "part"].map((id) => [id, item(id)]));
const overrides = { [metal]: { emptyValue: 10000 }, [blue]: { emptyValue: 0 } };

test("empty values apply only to reviewed, resolved containers; zero works", () => {
	assert.equal(getEmptyValue(metal, overrides), 10000);
	assert.equal(getEmptyValue(blue, overrides), 0);
	assert.equal(getEmptyValue("part", { part: { emptyValue: 1 } }), null);
	assert.equal(getEmptyValue(metal, { [metal]: { emptyValue: NaN } }), null);
	assert.equal(emptyIngredientPlan(undefined, 2, overrides), null);
});

test("crafts, barters and nested recipes use empty input costs and opportunity values", () => {
	const calculator = createRecipeCalculator({ itemsById, crafts, barters: [barter], overrides });
	const result = calculator.evaluateCraft(crafts[0]);
	assert.equal(result.cost, 18000);
	assert.equal(result.inputSellValue, 18000);
	assert.equal(result.requiredItems[0].method, "empty");
	assert.equal(result.profit, result.sellValue! - 18000);
	assert.equal(calculator.evaluateBarter(barter).cost, 0);
	const nested = calculator.evaluateCraft(crafts[1]);
	assert.equal(nested.cost, 36000);
	assert.equal(nested.requiredItems[0].children[0].method, "empty");
});

test("full-can purchases and outputs retain full pricing; tools and missing items do not become empty inputs", () => {
	const calculator = createRecipeCalculator({ itemsById, crafts, barters: [], overrides });
	assert.equal(calculator.evaluateNode(metal).totalCost, 100000);
	assert.equal(getItemBuyPrice(itemsById[metal], overrides), 100000);
	assert.deepEqual(getItemSellComparison(itemsById[metal], overrides), getItemSellComparison(itemsById[metal]));
	assert.equal(
		calculator.evaluateCraft(crafts[2]).sellValue,
		createRecipeCalculator({ itemsById, crafts, barters: [] }).evaluateCraft(crafts[2]).sellValue,
	);
	const toolCraft = { ...crafts[0], requiredItems: [{ itemId: metal, count: 1, isTool: true }] };
	assert.notEqual(calculator.evaluateCraft(toolCraft).requiredItems[0].method, "empty");
	const missing = createRecipeCalculator({ itemsById: { case: itemsById.case }, crafts, barters: [], overrides });
	assert.equal(missing.evaluateCraft(crafts[0]).cost, null);
	const reset = createRecipeCalculator({ itemsById, crafts, barters: [], overrides: {} });
	assert.equal(reset.evaluateCraft(crafts[0]).cost, 200000);
});

test("locked preview fallback and craft board use empty costs; per-recipe custom costs still win", () => {
	const calculator = createRecipeCalculator({ itemsById, crafts, barters: [], overrides });
	const plan = { ...calculator.evaluateNode("case"), method: "craft" as const, sourceId: "case", children: [] };
	const preview = getPlanRecipePreview(
		plan,
		{ itemById: itemsById, craftsById: { case: crafts[0] }, bartersById: {}, stationsById: {}, tradersById: {} },
		{ overrides },
	);
	assert.equal(preview?.requiredItems[0].totalCost, 18000);
	assert.equal(preview?.requiredItems[0].method, "empty");
	const board = buildStationBoard({ itemsById, crafts: [crafts[0]], barters: [], overrides })[0];
	assert.equal(selectedBoardCraft(board).cost, 18000);
	assert.equal(selectedBoardCraft(board, { variant: "direct", unitCosts: { [`${metal}:input`]: 15000 } }).cost, 30000);
});

test("gross empty prices stay unchanged while net values use profile tax reductions", () => {
	const taxContext = { stationLevels: { "intelligence-center": 3 }, hideoutManagementSkillLevel: 50 };
	assert.deepEqual(getEmptySale(itemsById[metal], overrides), { gross: 10000, fee: 1000, net: 9000 });
	assert.deepEqual(getEmptySale(itemsById[metal], overrides, taxContext), { gross: 10000, fee: 550, net: 9450 });
	const calculator = createRecipeCalculator({ itemsById, crafts, barters: [], overrides, ...taxContext });
	const result = calculator.evaluateCraft(crafts[0]);
	assert.equal(result.cost, 18900);
	assert.equal(result.inputSellValue, 18900);
	assert.equal(overrides[metal].emptyValue, 10000);
	const plan = { ...calculator.evaluateNode("case"), method: "craft" as const, sourceId: "case", children: [] };
	const preview = getPlanRecipePreview(
		plan,
		{ itemById: itemsById, craftsById: { case: crafts[0] }, bartersById: {}, stationsById: {}, tradersById: {} },
		{ overrides, ...taxContext },
	);
	assert.equal(preview?.requiredItems[0].totalCost, 18900);
});

test("missing tax base leaves empty routes and profits unknown; zero needs no base", () => {
	const missingBase = { ...itemsById[metal], marketPrice: { price: 100000 } };
	assert.deepEqual(getEmptySale(missingBase, overrides), { gross: 10000, fee: null, net: null });
	const calculator = createRecipeCalculator({
		itemsById: { ...itemsById, [metal]: missingBase },
		crafts,
		barters: [],
		overrides,
	});
	const result = calculator.evaluateCraft(crafts[0]);
	assert.equal(result.requiredItems[0].method, "empty");
	assert.equal(result.cost, null);
	assert.equal(result.profit, null);
	assert.equal(result.inputSellValue, null);
	assert.deepEqual(getEmptySale(missingBase, { [metal]: { emptyValue: 0 } }), { gross: 0, fee: 0, net: 0 });
	assert.equal(getEmptySale(itemsById[metal], { [metal]: { emptyValue: 1 } })?.net, 0);
});
