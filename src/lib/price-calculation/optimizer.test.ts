import assert from "node:assert/strict";
import test from "node:test";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { ItemSummary } from "@/types/items";
import { getItemSellComparison } from "./prices";
import {
    createAcquisitionOptimizer,
    createRecipeCalculator,
    evaluateBarter,
    evaluateCraft,
} from "./optimizer";

function item(id: string, buy: number, sell = buy): ItemSummary {
    return {
        id,
        name: id,
        normalizedName: id.toLowerCase(),
        marketPrice: {
            avg24hPrice: buy,
            sellFor: [{ vendor: { name: "Trader", normalizedName: "trader" }, priceRUB: sell }],
        },
    };
}

function traderItem(
    id: string,
    offers: NonNullable<ItemSummary["buyFromTrader"]>,
    fleaPrice?: number,
): ItemSummary {
    return {
        id,
        name: id,
        normalizedName: id.toLowerCase(),
        buyFromTrader: offers,
        ...(fleaPrice === undefined ? {} : { marketPrice: { avg24hPrice: fleaPrice } }),
    };
}

function traderOffer(overrides: Partial<NonNullable<ItemSummary["buyFromTrader"]>[number]> = {}) {
    return {
        traderId: "prapor",
        price: 100,
        priceRUB: 100,
        currency: "RUB",
        currencyItemId: "roubles",
        minTraderLevel: 1,
        ...overrides,
    };
}

test("unstable flea estimates consistently price acquisition, sales, profit and profit/hour", () => {
    const unstable: ItemSummary = { ...item("A", 925_926), marketPrice: {
        price: 120_000, referencePrice: 973_333, fleaStability: "unstable",
        sellFor: [{ vendor: { name: "Mechanic", normalizedName: "mechanic" }, priceRUB: 50_000 }],
    } };
    const craft: CraftRecord = { id: "c", productItemId: "A", productCount: 1, stationId: "workbench", level: 1, duration: 1800, requiredItems: [{ itemId: "B", count: 1 }], requiredQuestItems: [], gameEditions: [] };
    const input = { itemsById: { A: unstable, B: item("B", 100, 80) }, crafts: [craft], barters: [] };
    const evaluation = createRecipeCalculator(input).evaluateCraft(craft);
    assert.equal(evaluation.sellValue, 120_000);
    assert.equal(evaluation.profit, 119_900);
    assert.equal(evaluation.profitPerHour, 239_800);
    assert.equal(evaluation.sellSourceLabel, "Flea market");
    assert.equal(evaluation.sellValueIsEstimate, true);
    assert.equal(createRecipeCalculator({ ...input, crafts: [] }).evaluateNode("A").totalCost, 120_000);
    const manual = createRecipeCalculator({ ...input, overrides: { A: { buy: 110_000, sell: 130_000 } } });
    assert.equal(manual.evaluateCraft(craft).profit, 129_900);
    assert.equal(manual.evaluateCraft(craft).profitPerHour, 259_800);
    assert.equal(manual.evaluateCraft(craft).sellValueIsEstimate, false);
    assert.equal(manual.evaluateCraft(craft).sellSourceLabel, "Manual price");
    const roughInput = createRecipeCalculator({ ...input, itemsById: { A: item("A", 500), B: { ...unstable, id: "B" } } }).evaluateCraft(craft);
    assert.equal(roughInput.cost, 120_000);
    assert.equal(roughInput.profit, -119_500);
    assert.equal(roughInput.profitPerHour, -239_000);
    assert.equal(roughInput.profitVsSellingInputs, -119_500);
    assert.equal(roughInput.sellValueIsEstimate, false);
    const higherTrader = { ...unstable, marketPrice: { ...unstable.marketPrice, sellFor: [{ vendor: { name: "Trader", normalizedName: "trader" }, priceRUB: 150_000 }] } };
    assert.equal(getItemSellComparison(higherTrader).selectedSource, "trader");
    assert.equal(getItemSellComparison(higherTrader).isEstimate, false);
    assert.equal(getItemSellComparison(unstable, { A: { sell: 0 } }).isEstimate, false);
    const unavailable = createRecipeCalculator({ ...input, itemsById: { ...input.itemsById, A: { ...unstable, marketPrice: { price: null, fleaStability: "unavailable" } } } }).evaluateCraft(craft);
    assert.equal(unavailable.sellValue, null);
    assert.equal(unavailable.profitPerHour, null);
});

test("uses a trader-only direct acquisition and retains native offer data", () => {
    const offer = traderOffer({ price: 53, priceRUB: 6_625, currency: "USD", currencyItemId: "dollars" });
    const calculator = createRecipeCalculator({
        itemsById: { A: traderItem("A", [offer]) },
        barters: [],
        crafts: [],
    });

    const plan = calculator.evaluateNode("A", 2);
    assert.equal(plan.method, "trader");
    assert.equal(plan.totalCost, 13_250);
    assert.equal(plan.durationSeconds, 0);
    assert.deepEqual(plan.children, []);
    assert.equal(plan.traderOffer?.price, 53);
    assert.equal(plan.traderOffer?.currency, "USD");
});

test("chooses the genuinely cheapest flea or trader direct route", () => {
    const cheapTrader = createRecipeCalculator({
        itemsById: { A: traderItem("A", [traderOffer({ priceRUB: 80 })], 100) },
        barters: [], crafts: [],
    }).evaluateNode("A");
    const cheapFlea = createRecipeCalculator({
        itemsById: { A: traderItem("A", [traderOffer({ priceRUB: 120 })], 100) },
        barters: [], crafts: [],
    }).evaluateNode("A");

    assert.equal(cheapTrader.method, "trader");
    assert.equal(cheapTrader.directBuyCost, 80);
    assert.equal(cheapFlea.method, "flea");
    assert.equal(cheapFlea.directBuyCost, 100);
    assert.equal(cheapFlea.alternatives[0]?.method, "trader");
    assert.equal(cheapFlea.alternatives[0]?.traderOffer?.priceRUB, 120);
});

test("applies the practical threshold only between recursive and cheapest direct routes", () => {
    const barter: BarterRecord = {
        id: "barter-a", offeredItemId: "A", offeredCount: 1, traderId: "mechanic",
        minTraderLevel: 1, requiredItems: [{ itemId: "B", count: 1 }],
    };
    const craft: CraftRecord = {
        id: "craft-a", productItemId: "A", productCount: 1, stationId: "workbench", level: 1,
        duration: 60, requiredItems: [{ itemId: "C", count: 1 }], requiredQuestItems: [], gameEditions: [],
    };
    const items = {
        A: traderItem("A", [traderOffer({ priceRUB: 90 })], 100),
        B: item("B", 87),
        C: item("C", 70),
    };
    const calculator = createRecipeCalculator({ itemsById: items, barters: [barter], crafts: [craft] });
    const plan = calculator.evaluateNode("A");

    assert.equal(plan.method, "craft");
    assert.equal(plan.directBuyCost, 90);
    assert.equal(plan.theoreticalMethod, "craft");
    assert.deepEqual(plan.alternatives.map((entry) => entry.method), ["barter", "trader", "flea"]);
    const evaluation = calculator.evaluateCraft(craft);
    assert.equal(evaluation.directBuyCost, 90);
    assert.equal(evaluation.directBuyMethod, "trader");

    const nearBarter = createRecipeCalculator({
        itemsById: { ...items, C: item("C", 89) },
        barters: [barter], crafts: [craft],
    }).evaluateNode("A");
    assert.equal(nearBarter.method, "trader");
    assert.equal(nearBarter.theoreticalMethod, "barter");
});

test("keeps multiple trader offers distinct and retains trader alternatives", () => {
    const plan = createRecipeCalculator({
        itemsById: {
            A: traderItem("A", [
                traderOffer({ price: 90, priceRUB: 90 }),
                traderOffer({ price: 80, priceRUB: 80 }),
            ]),
        },
        barters: [], crafts: [],
    }).evaluateNode("A");

    assert.equal(plan.method, "trader");
    assert.equal(plan.traderOffer?.price, 80);
    assert.equal(plan.alternatives.length, 1);
    assert.equal(plan.alternatives[0]?.traderOffer?.price, 90);
    assert.notEqual(plan.sourceId, plan.alternatives[0]?.sourceId);
});

test("enforces trader loyalty and quest unlocks and supports disabling trader purchases", () => {
    const locked = traderItem("A", [
        traderOffer({ priceRUB: 50, minTraderLevel: 2 }),
        traderOffer({ priceRUB: 40, taskUnlockId: "quest-a" }),
    ], 100);
    const defaultPlan = createRecipeCalculator({ itemsById: { A: locked }, barters: [], crafts: [] }).evaluateNode("A");
    const unlockedPlan = createRecipeCalculator({
        itemsById: { A: locked }, barters: [], crafts: [],
        traderLoyaltyLevels: { prapor: 2 }, completedQuests: { "quest-a": true },
    }).evaluateNode("A");
    const disabledPlan = createRecipeCalculator({
        itemsById: { A: locked }, barters: [], crafts: [],
        traderLoyaltyLevels: { prapor: 4 }, completedQuests: { "quest-a": true },
        allowTraderPurchases: false,
    }).evaluateNode("A");

    assert.equal(defaultPlan.method, "flea");
    assert.equal(unlockedPlan.method, "trader");
    assert.equal(unlockedPlan.traderOffer?.taskUnlockId, "quest-a");
    assert.equal(disabledPlan.method, "flea");
});

test("ignores malformed trader prices", () => {
    const plan = createRecipeCalculator({
        itemsById: {
            A: traderItem("A", [
                traderOffer({ price: Number.NaN, priceRUB: 1 }),
                traderOffer({ price: 1, priceRUB: Number.POSITIVE_INFINITY }),
                traderOffer({ price: -1, priceRUB: -1 }),
                traderOffer({ price: 0, priceRUB: 0 }),
            ], 100),
        },
        barters: [], crafts: [],
    }).evaluateNode("A");

    assert.equal(plan.method, "flea");
    assert.deepEqual(plan.alternatives, []);
});

test("combines flea, barter, and craft routes while preserving theoretical savings", () => {
    const barter: BarterRecord = {
        id: "barter-b",
        offeredItemId: "B",
        offeredCount: 1,
        traderId: "trader",
        minTraderLevel: 1,
        requiredItems: [{ itemId: "D", count: 1 }],
    };
    const ingredientCraft: CraftRecord = {
        id: "craft-c",
        productItemId: "C",
        productCount: 1,
        stationId: "station",
        level: 1,
        duration: 600,
        requiredItems: [{ itemId: "E", count: 1 }],
        requiredQuestItems: [],
        gameEditions: [],
    };
    const outputCraft: CraftRecord = {
        id: "craft-a",
        productItemId: "A",
        productCount: 1,
        stationId: "station",
        level: 1,
        duration: 3_600,
        requiredItems: [{ itemId: "B", count: 1 }, { itemId: "C", count: 1 }],
        requiredQuestItems: [],
        gameEditions: [],
    };
    const items = [item("A", 150, 500), item("B", 100), item("C", 100), item("D", 40), item("E", 96)];
    const context = {
        itemsById: Object.fromEntries(items.map((entry) => [entry.id, entry])),
        bartersByItemId: { B: [barter] },
        craftsByItemId: { C: [ingredientCraft], A: [outputCraft] },
    };

    const evaluation = evaluateCraft(outputCraft, context);

    assert.equal(evaluation.cost, 140);
    assert.equal(evaluation.theoreticalCost, 136);
    assert.equal(evaluation.profit, 360);
    assert.equal(evaluation.durationSeconds, 3_600);
    assert.equal(evaluation.requiredItems[0].method, "barter");
    assert.equal(evaluation.requiredItems[1].method, "flea");
    assert.equal(evaluation.requiredItems[1].theoreticalMethod, "craft");
});

test("manual prices override avg24hPrice", () => {
    const optimizer = createAcquisitionOptimizer({
        itemsById: { A: item("A", 100) },
        bartersByItemId: {},
        craftsByItemId: {},
        overrides: { A: { buy: 25 } },
    });

    assert.equal(optimizer.optimize("A", 3).totalCost, 75);
});

test("compares recipe output against selling the required items", () => {
    const craft: CraftRecord = {
        id: "wasteful-craft",
        productItemId: "A",
        productCount: 1,
        stationId: "station",
        level: 1,
        duration: 60,
        requiredItems: [{ itemId: "B", count: 2 }],
        requiredQuestItems: [],
        gameEditions: [],
    };
    const items = [item("A", 100, 100), item("B", 25, 60)];
    const evaluation = evaluateCraft(craft, {
        itemsById: Object.fromEntries(items.map((entry) => [entry.id, entry])),
        bartersByItemId: {},
        craftsByItemId: {},
    });

    assert.equal(evaluation.cost, 50);
    assert.equal(evaluation.profit, 50);
    assert.equal(evaluation.inputSellValue, 120);
    assert.equal(evaluation.profitVsSellingInputs, -20);
});

test("compares flea and trader sales in roubles while retaining trader currency", () => {
    const pricedItem = item("A", 6_000);
    pricedItem.marketPrice!.sellFor = [{
        vendor: { name: "Peacekeeper", normalizedName: "peacekeeper" },
        price: 53,
        currency: "USD",
        priceRUB: 6_622,
    }];

    const comparison = getItemSellComparison(pricedItem);

    assert.equal(comparison.selectedSource, "trader");
    assert.equal(comparison.selectedPrice, 6_622);
    assert.equal(comparison.bestTraderOffer?.price, 53);
    assert.equal(comparison.bestTraderOffer?.currency, "USD");
});

test("cyclic recipes terminate as unavailable", () => {
    const craftX: CraftRecord = {
        id: "craft-x", productItemId: "X", productCount: 1, stationId: "s", level: 1,
        duration: 1, requiredItems: [{ itemId: "Y", count: 1 }], requiredQuestItems: [], gameEditions: [],
    };
    const craftY: CraftRecord = {
        id: "craft-y", productItemId: "Y", productCount: 1, stationId: "s", level: 1,
        duration: 1, requiredItems: [{ itemId: "X", count: 1 }], requiredQuestItems: [], gameEditions: [],
    };
    const optimizer = createAcquisitionOptimizer({
        itemsById: {},
        bartersByItemId: {},
        craftsByItemId: { X: [craftX], Y: [craftY] },
    });

    assert.equal(optimizer.optimize("X").method, "unavailable");
});

test("zero-input production is not treated as a free ingredient source", () => {
    const passiveCraft: CraftRecord = {
        id: "passive", productItemId: "BTC", productCount: 1, stationId: "farm", level: 1,
        duration: 1, requiredItems: [], requiredQuestItems: [], gameEditions: [],
    };
    const optimizer = createAcquisitionOptimizer({
        itemsById: { BTC: item("BTC", 700_000) },
        bartersByItemId: {},
        craftsByItemId: { BTC: [passiveCraft] },
    });

    assert.equal(optimizer.optimize("BTC").method, "flea");
    assert.equal(optimizer.optimize("BTC").totalCost, 700_000);
});

test("reusable tools are excluded from recurring craft cost", () => {
    const craft: CraftRecord = {
        id: "tool-craft", productItemId: "A", productCount: 1, stationId: "s", level: 1,
        duration: 3_600,
        requiredItems: [
            { itemId: "B", count: 2 },
            { itemId: "TOOL", count: 1, isTool: true },
        ],
        requiredQuestItems: [], gameEditions: [],
    };
    const items = [item("A", 500, 500), item("B", 100), item("TOOL", 1_000)];
    const evaluation = evaluateCraft(craft, {
        itemsById: Object.fromEntries(items.map((entry) => [entry.id, entry])),
        bartersByItemId: {}, craftsByItemId: { A: [craft] },
    });

    assert.equal(evaluation.cost, 200);
    assert.equal(evaluation.requiredItems.find((plan) => plan.itemId === "TOOL")?.isTool, true);
});

test("recursive craft and barter routes can be disabled independently", () => {
    const barter: BarterRecord = {
        id: "barter-a", offeredItemId: "A", offeredCount: 1, traderId: "t",
        minTraderLevel: 1, requiredItems: [{ itemId: "B", count: 1 }],
    };
    const craft: CraftRecord = {
        id: "craft-a", productItemId: "A", productCount: 1, stationId: "s", level: 1,
        duration: 1, requiredItems: [{ itemId: "B", count: 1 }],
        requiredQuestItems: [], gameEditions: [],
    };
    const items = [item("A", 100), item("B", 10)];
    const base = {
        itemsById: Object.fromEntries(items.map((entry) => [entry.id, entry])),
        bartersByItemId: { A: [barter] }, craftsByItemId: { A: [craft] },
    };

    assert.equal(createAcquisitionOptimizer({ ...base, allowBarters: false }).optimize("A").method, "craft");
    assert.equal(createAcquisitionOptimizer({ ...base, allowCrafts: false }).optimize("A").method, "barter");
    assert.equal(createAcquisitionOptimizer({ ...base, allowBarters: false, allowCrafts: false }).optimize("A").method, "flea");
});

test("allocates nested craft time across every produced item", () => {
    const ingredientCraft: CraftRecord = {
        id: "craft-b", productItemId: "B", productCount: 4, stationId: "s", level: 1,
        duration: 400, requiredItems: [{ itemId: "C", count: 1 }], requiredQuestItems: [], gameEditions: [],
    };
    const outputCraft: CraftRecord = {
        id: "craft-a", productItemId: "A", productCount: 1, stationId: "s", level: 1,
        duration: 3_600, requiredItems: [{ itemId: "B", count: 1 }], requiredQuestItems: [], gameEditions: [],
    };
    const outputBarter: BarterRecord = {
        id: "barter-x", offeredItemId: "X", offeredCount: 1, traderId: "t", minTraderLevel: 1,
        requiredItems: [{ itemId: "B", count: 1 }],
    };
    const items = [item("A", 2_000, 1_000), item("X", 2_000, 1_000), item("B", 1_000), item("C", 100)];
    const context = {
        itemsById: Object.fromEntries(items.map((entry) => [entry.id, entry])),
        bartersByItemId: {},
        craftsByItemId: { B: [ingredientCraft] },
    };

    const craftEvaluation = evaluateCraft(outputCraft, context);
    const barterEvaluation = evaluateBarter(outputBarter, context);

    assert.equal(craftEvaluation.requiredItems[0].method, "craft");
    assert.equal(craftEvaluation.durationSeconds, 3_700);
    assert.equal(barterEvaluation.durationSeconds, 100);
    assert.equal(barterEvaluation.profitPerHour, 68_400);
});

test("reuses a stored recipe graph with different live price contexts", () => {
    const barter: BarterRecord = {
        id: "barter-a",
        offeredItemId: "A",
        offeredCount: 1,
        traderId: "t",
        minTraderLevel: 1,
        requiredItems: [{ itemId: "B", count: 1 }],
    };
    const graph = { barters: [barter], crafts: [] as CraftRecord[] };
    const items = {
        A: item("A", 100),
        B: item("B", 40),
    };

    const marketCalculator = createRecipeCalculator({
        ...graph,
        itemsById: items,
    });
    const refreshedCalculator = createRecipeCalculator({
        ...graph,
        itemsById: items,
        overrides: { A: { buy: 42 } },
    });

    const marketPlan = marketCalculator.evaluateNode("A");
    const refreshedPlan = refreshedCalculator.evaluateNode("A");

    assert.equal(marketPlan.method, "barter");
    assert.deepEqual(
        marketPlan.alternatives.map((alternative) => alternative.method),
        ["flea"],
    );
    assert.equal(refreshedPlan.method, "flea");
    assert.deepEqual(
        refreshedPlan.alternatives.map((alternative) => alternative.method),
        ["barter"],
    );
});
