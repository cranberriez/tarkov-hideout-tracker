import assert from "node:assert/strict";
import test from "node:test";
import type { AcquisitionPlan, RecipeEvaluation } from "@/lib/price-calculation";
import type { RouteContext } from "../types";
import {
	NO_ROUTE_MESSAGE,
	describeSelectedLock,
	getProfileLockGaps,
	ingredientLockReasons,
	summarizeLockReasons,
	summarizeRecipeRequirements,
	unpricedIngredientIds,
} from "./lock-summary";

const plan = (overrides: Partial<AcquisitionPlan> = {}): AcquisitionPlan => ({
	itemId: "item",
	quantity: 1,
	method: "flea",
	batches: 1,
	totalCost: 100,
	theoreticalCost: 100,
	theoreticalMethod: "flea",
	directBuyCost: 100,
	directBuyMethod: "flea",
	durationSeconds: 0,
	children: [],
	alternatives: [],
	...overrides,
});

test("chips keep the highest flea level and drop generic route summaries", () => {
	const chips = summarizeLockReasons([
		{ kind: "flea", message: "Flea unlocks at lvl 20", requiredLevel: 20 },
		{ kind: "flea", message: "Flea unlocks at lvl 35", requiredLevel: 35 },
		{ kind: "flea", message: "Flea unlocks at lvl 15", requiredLevel: 15 },
		{ kind: "unavailable", message: NO_ROUTE_MESSAGE },
		{ kind: "unavailable", message: "Recipe ingredients have no accessible priced route" },
	]);
	assert.deepEqual(
		chips.map((chip) => chip.label),
		["Flea lvl 35"],
	);
});

test("not-on-flea wins over flea levels", () => {
	const chips = summarizeLockReasons([
		{ kind: "flea", message: "Flea unlocks at lvl 40", requiredLevel: 40 },
		{ kind: "flea", message: "Not on flea" },
		{ kind: "flea", message: "Flea unlocks at lvl 50", requiredLevel: 50 },
	]);
	assert.deepEqual(
		chips.map((chip) => chip.label),
		["No flea"],
	);
});

test("station and vendor chips name the source and required level, ordered before flea", () => {
	const chips = summarizeLockReasons(
		[
			{ kind: "flea", message: "Flea unlocks at lvl 20", requiredLevel: 20 },
			{ kind: "quest", message: "Complete required quest", questId: "q1" },
			{ kind: "vendor", message: "Trader is LL1", sourceId: "prapor", requiredLevel: 4 },
			{ kind: "station", message: "Station is lvl 0", sourceId: "bench", requiredLevel: 3 },
			{ kind: "station", message: "Station is lvl 0", sourceId: "bench", requiredLevel: 2 },
		],
		{ station: (id) => (id === "bench" ? "Workbench" : undefined), trader: () => undefined },
	);
	assert.deepEqual(
		chips.map((chip) => [chip.kind, chip.label, chip.tone]),
		[
			["station", "Workbench 3", "lock"],
			["vendor", "Trader LL4", "lock"],
			["quest", "Quest", "lock"],
			["flea", "Flea lvl 20", "lock"],
		],
	);
	assert.equal(chips[2].questId, "q1");
});

test("flea chips covered by the profile banner are omitted without reviving route summaries", () => {
	const reasons = [
		{ kind: "flea" as const, message: "Flea unlocks at lvl 15", requiredLevel: 15 },
		{ kind: "unavailable" as const, message: NO_ROUTE_MESSAGE },
	];
	assert.deepEqual(summarizeLockReasons(reasons, {}, { coveredFleaLevel: 15 }), []);
	assert.deepEqual(
		summarizeLockReasons(
			[...reasons, { kind: "flea", message: "Flea unlocks at lvl 30", requiredLevel: 30 }],
			{},
			{ coveredFleaLevel: 15 },
		).map((chip) => chip.label),
		["Flea lvl 30"],
	);
});

test("a lone route summary remains as one problem chip", () => {
	const chips = summarizeLockReasons([
		{ kind: "unavailable", message: NO_ROUTE_MESSAGE },
		{ kind: "unavailable", message: "No available route" },
	]);
	assert.deepEqual(
		chips.map((chip) => [chip.label, chip.tone]),
		[["No route", "problem"]],
	);
	assert.deepEqual(
		summarizeLockReasons([{ kind: "unavailable", message: "Flea purchase price unavailable" }]).map(
			(chip) => chip.label,
		),
		["No price"],
	);
});

test("ingredient reasons describe the selected route, not nested alternatives", () => {
	const fleaReasons = [{ kind: "flea" as const, message: "Flea unlocks at lvl 35", requiredLevel: 35 }];
	const lockedFallback = plan({
		lockReasons: [
			...fleaReasons,
			{ kind: "station", message: "Station is lvl 0", sourceId: "bench", requiredLevel: 1 },
			{ kind: "flea", message: "Flea unlocks at lvl 20", requiredLevel: 20 },
			{ kind: "unavailable", message: NO_ROUTE_MESSAGE },
		],
		lockedAlternatives: [
			{ method: "flea", lockReasons: fleaReasons },
			{
				method: "craft",
				sourceId: "c",
				lockReasons: [
					{ kind: "station", message: "Station is lvl 0", sourceId: "bench", requiredLevel: 1 },
					{ kind: "flea", message: "Flea unlocks at lvl 20", requiredLevel: 20 },
				],
			},
		],
	});
	assert.deepEqual(ingredientLockReasons(lockedFallback), fleaReasons);
	assert.deepEqual(ingredientLockReasons(plan()), []);
	const unavailable = plan({
		method: "unavailable",
		totalCost: null,
		lockedAlternatives: [
			{ method: "trader", sourceId: "t", lockReasons: [{ kind: "vendor", message: "Trader is LL1" }] },
			{ method: "barter", sourceId: "b", lockReasons: [{ kind: "quest", message: "Complete required quest" }] },
		],
	});
	assert.deepEqual(
		ingredientLockReasons(unavailable).map((reason) => reason.kind),
		["vendor", "unavailable"],
	);
});

test("unpriced non-tool ingredients are reported explicitly", () => {
	const evaluation = {
		lockReasons: [],
		outputLockReasons: [],
		requiredItems: [
			plan({ itemId: "priced" }),
			plan({ itemId: "tool", isTool: true, totalCost: null }),
			plan({ itemId: "missing", totalCost: null }),
		],
	} as unknown as RecipeEvaluation;
	assert.deepEqual(unpricedIngredientIds(evaluation), ["missing"]);
});

test("profile gaps cover flea level, unset hideout and base loyalty", () => {
	const fresh = { playerLevel: 1, stationLevels: {}, traderLoyaltyLevels: {} };
	assert.deepEqual(
		getProfileLockGaps("craft", fresh).map((gap) => gap.key),
		["player", "hideout", "traders"],
	);
	assert.deepEqual(
		getProfileLockGaps("barter", fresh).map((gap) => gap.key),
		["player", "traders"],
	);
	assert.deepEqual(
		getProfileLockGaps("craft", { playerLevel: 20, stationLevels: { bench: 1 }, traderLoyaltyLevels: { p: 2 } }),
		[],
	);
});

test("recipe requirements fold own source, sale and ingredient locks into one line with grouped detail", () => {
	const evaluation = {
		craft: { stationId: "bench", level: 2 },
		lockReasons: [
			{ kind: "station", message: "Station is lvl 0", sourceId: "bench", requiredLevel: 2 },
			{ kind: "quest", message: "Complete required quest", questId: "q1" },
		],
		outputLockReasons: [{ kind: "flea", message: "Not on flea" }],
		requiredItems: [
			plan({ itemId: "a", lockReasons: [{ kind: "flea", message: "Flea unlocks at lvl 30", requiredLevel: 30 }] }),
			plan({ itemId: "b", lockReasons: [{ kind: "flea", message: "Flea unlocks at lvl 20", requiredLevel: 20 }] }),
			plan({ itemId: "c" }),
			plan({ itemId: "t", isTool: true, method: "unavailable", totalCost: null }),
		],
	} as unknown as RecipeEvaluation;
	const result = summarizeRecipeRequirements(evaluation, {
		names: { station: () => "Workbench" },
		itemName: (id) => id.toUpperCase(),
	});
	assert.deepEqual(
		result.line.map((chip) => chip.label),
		["Quest", "No flea sale", "Flea lvl 30"],
	);
	assert.deepEqual(
		result.groups.map((group) => [group.title, group.chips.map((chip) => chip.label)]),
		[
			["Recipe", ["Workbench 2", "Quest"]],
			["Selling the output", ["No flea sale"]],
			["A", ["Flea lvl 30"]],
			["B", ["Flea lvl 20"]],
			["T (tool)", ["No route"]],
		],
	);
	assert.equal(result.hasProblem, true);
});

test("selected lock reads as plain sentences and keeps only a recipe's own gates", () => {
	const context = {
		itemById: {},
		bartersById: {},
		craftsById: { c: { id: "c", stationId: "bench", level: 2, taskUnlockId: "q1" } },
		tradersById: { prapor: { name: "Prapor" } },
		stationsById: {},
	} as unknown as RouteContext;
	const lockedAlternatives: AcquisitionPlan["lockedAlternatives"] = [
		{ method: "flea", lockReasons: [{ kind: "flea", message: "Flea unlocks at lvl 35", requiredLevel: 35 }] },
		{
			method: "trader",
			sourceId: "t",
			traderOffer: { traderId: "prapor", minTraderLevel: 3 } as never,
			lockReasons: [{ kind: "vendor", message: "Trader is LL1", sourceId: "prapor", requiredLevel: 3 }],
		},
		{
			method: "craft",
			sourceId: "c",
			lockReasons: [
				{ kind: "station", message: "Station is lvl 0", sourceId: "bench", requiredLevel: 2 },
				{ kind: "quest", message: "Complete required quest", questId: "q1" },
				{ kind: "flea", message: "Flea unlocks at lvl 20", requiredLevel: 20 },
				{ kind: "vendor", message: "Trader is LL1", sourceId: "other", requiredLevel: 2 },
				{ kind: "unavailable", message: "Required reusable tool has no accessible acquisition route" },
			],
		},
	];
	const texts = (selected: Partial<AcquisitionPlan>) =>
		describeSelectedLock(plan({ lockedAlternatives, ...selected }), context).map((reason) => reason.text);

	assert.deepEqual(texts({ method: "flea" }), ["Unlocks at level 35"]);
	assert.deepEqual(texts({ method: "craft", sourceId: "c" }), ["Needs station level 2 (yours: lvl 0)", "Complete"]);
	assert.deepEqual(texts({ method: "barter", sourceId: "unlocked" }), []);
	assert.deepEqual(texts({ method: "unavailable" }), [
		"Flea market unlocks at level 35",
		"Prapor needs LL3 (yours: LL1)",
	]);
	assert.equal(
		describeSelectedLock(plan({ lockedAlternatives, method: "craft", sourceId: "c" }), context)[1].questId,
		"q1",
	);
});
