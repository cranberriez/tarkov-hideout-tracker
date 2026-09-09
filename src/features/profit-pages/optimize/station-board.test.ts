import test from "node:test";
import assert from "node:assert/strict";
import { boardCraftPlacements, buildStationBoard, selectedBoardCraft, boardCraftAvailable, boardMaterials, parseBoardChoices, rankBoardCrafts, visibleBoardCrafts } from "./station-board";
import { createRecipeCalculator } from "../../../lib/price-calculation/optimizer";
import type { RecipeCalculatorInput } from "../../../lib/price-calculation/types";
import { parsePinnedCrafts } from "../usePinnedCrafts";
import { parsePriceOverrides } from "../useManualPriceOverrides";

function fixture(): RecipeCalculatorInput {
	return {
		playerLevel: 30,
		stationLevels: { workbench: 3, medstation: 3 },
		barters: [],
		itemsById: Object.fromEntries(
			[
				["a", 20_000],
				["b", 3_000],
				["c", 100],
			].map(([id, price]) => [
				id,
				{
					id: String(id),
					name: String(id),
					normalizedName: String(id),
					marketPrice: {
						avg24hPrice: Number(price),
						sellFor: [{ vendor: { name: "Therapist", normalizedName: "therapist" }, priceRUB: Number(price) * 0.51 }],
					},
				},
			]),
		),
		crafts: [
			{
				id: "output",
				productItemId: "a",
				productCount: 2,
				stationId: "workbench",
				level: 1,
				duration: 3600,
				requiredItems: [{ itemId: "b", count: 2 }],
				requiredQuestItems: [],
				gameEditions: [],
			},
			{
				id: "input",
				productItemId: "b",
				productCount: 2,
				stationId: "medstation",
				level: 1,
				duration: 600,
				requiredItems: [{ itemId: "c", count: 1 }],
				requiredQuestItems: [],
				gameEditions: [],
			},
		],
	};
}
test("board and profit table share net proceeds and input routes", () => {
	const input = fixture();
	const craft = buildStationBoard(input).find((row) => row.id === "output")!;
	const direct = selectedBoardCraft(craft);
	const table = createRecipeCalculator({ ...input, allowCrafts: false, allowBarters: false }).evaluateCraft(input.crafts[0]);
	assert.equal(direct.profit, table.profit);
	assert.equal(direct.profit, 30_000);
	assert.equal(direct.sellFee, 4_000);
	assert.equal(selectedBoardCraft(craft, { variant: "craft" }).cost, 100);
	assert.ok(boardCraftAvailable(direct));
});
test("saved craft/route remains selected through a loss, ranking and missing route", () => {
	const input = fixture();
	const craft = buildStationBoard(input).find((row) => row.id === "output")!;
	const choice = { variant: "direct" as const, unitCosts: { "b:input": 30_000 } };
	const selected = selectedBoardCraft(craft, choice);
	assert.equal(selected.profit, -24_000);
	assert.ok(boardCraftAvailable(selected));
	for (const ranking of ["profit", "easy", "duration", "profit-hour"] as const) rankBoardCrafts([selected], ranking);
	assert.equal(selectedBoardCraft(craft, choice).profit, -24_000);
	const stale = selectedBoardCraft(craft, { variant: "direct", routes: { "b:input": "barter:removed" } });
	assert.equal(stale.profit, null);
	assert.equal(boardCraftAvailable(stale), false);
});
test("board visibility and order stay based on the initial evaluation while choices change", () => {
	const input = fixture();
	const baseline = buildStationBoard(input).map((craft) => selectedBoardCraft(craft));
	const changed = baseline.map((row) => row.id === "output" ? { ...row, profit: -24_000, profitPerHour: -24_000 } : row);
	const expectedOrder = rankBoardCrafts(baseline.filter((row) => boardCraftAvailable(row) && (row.profit ?? 0) > 0), "profit-hour").map((row) => row.id);
	const visible = visibleBoardCrafts({
		rows: changed,
		baselineRows: baseline,
		ranking: "profit-hour",
		includeLosses: false,
		pinnedCrafts: {},
		hideUnpinned: false,
	});
	assert.deepEqual(visible.map((row) => row.id), expectedOrder);
	assert.equal(visible.find((row) => row.id === "output")?.profit, -24_000);
	assert.deepEqual(visibleBoardCrafts({
		rows: changed,
		baselineRows: baseline,
		ranking: "profit-hour",
		includeLosses: false,
		pinnedCrafts: { input: true },
		hideUnpinned: true,
	}).map((row) => row.id), ["input"]);
});
test("station placements mark the top three profitable available crafts", () => {
	const rows = buildStationBoard(fixture()).map((craft) => selectedBoardCraft(craft));
	const ranked = rankBoardCrafts(rows.filter((row) => boardCraftAvailable(row) && (row.profit ?? 0) > 0), "profit-hour");
	assert.deepEqual(boardCraftPlacements(rows, "profit-hour"), Object.fromEntries(ranked.slice(0, 3).map((row, index) => [row.id, index + 1])));
});
test("materials pool purchased leaves and preserve quantities", () => {
	const craft = buildStationBoard(fixture()).find((row) => row.id === "output")!;
	const row = selectedBoardCraft(craft, { variant: "craft" });
	const materials = boardMaterials([row, row]);
	assert.equal(materials.length, 1);
	assert.equal(materials[0].itemId, "c");
	assert.equal(materials[0].quantity, 2);
});
test("older pins and price overrides survive; malformed board entries are ignored", () => {
	assert.deepEqual(parsePinnedCrafts('["output","input",7]'), { output: true, input: true });
	assert.deepEqual(parsePriceOverrides('{"a":{"buy":0,"sell":200}}'), { a: { buy: 0, sell: 200 } });
	assert.deepEqual(parseBoardChoices('{"a":{"variant":"direct","unitCosts":{"b":0,"c":-1}},"bad":{"variant":"???"}}'), {
		a: { variant: "direct", routes: {}, unitCosts: { b: 0 } },
	});
});
