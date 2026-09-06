import assert from "node:assert/strict";
import test from "node:test";
import type { ItemSummary } from "@/types/items";
import type { CraftRecord } from "@/types/recipes";
import { createRecipeCalculator, getFleaLockReasons, getRecipeLockReasons } from "./index";

test("nested crafts with unavailable tools fall back without charging recurring tool costs", () => {
    const nested = { ...craft("nested-tool", "B", "C"), requiredItems: [
        { itemId: "C", count: 1 }, { itemId: "tool", count: 1, isTool: true },
    ] };
    const parent = craft("parent-tool", "A", "B");
    const tool = { ...item("tool", 5000), onFleaMarket: false, buyFromTrader: [{
        traderId: "vendor", minTraderLevel: 1, taskUnlockId: "tool-quest",
        price: 5000, priceRUB: 5000, currency: "RUB", currencyItemId: "roubles",
    }] };
    const input = { itemsById: { A: item("A", 1000), B: item("B", 100), C: item("C", 10), tool },
        crafts: [parent, nested], barters: [] };
    const calculator = createRecipeCalculator(input);
    const evaluation = calculator.evaluateCraft(parent);
    assert.equal(evaluation.cost, 100);
    assert.equal(evaluation.requiredItems[0].method, "flea");
    const locked = evaluation.requiredItems[0].lockedAlternatives?.find(route => route.sourceId === nested.id);
    assert.equal(locked?.lockReasons.some(reason => reason.questId === "tool-quest"), true);
    assert.equal(locked?.lockReasons.some(reason => reason.message === "Required reusable tool has no accessible acquisition route"), true);
    const hypothetical = calculator.evaluateCraft(nested);
    assert.equal(hypothetical.cost, 10);
    assert.equal(hypothetical.requiredItems.find(plan => plan.isTool)?.method, "unavailable");
    const unlocked = createRecipeCalculator({ ...input, completedQuests: { "tool-quest": true } }).evaluateCraft(parent);
    assert.equal(unlocked.requiredItems[0].method, "craft");
    assert.equal(unlocked.cost, 10);
    assert.equal(unlocked.requiredItems[0].children.find(plan => plan.isTool)?.totalCost, 5000);
});

const item = (id: string, price = 100): ItemSummary => ({ id, name: id, normalizedName: id,
    marketPrice: { avg24hPrice: price, sellFor: [{ vendor: { name: "Trader", normalizedName: "trader" }, priceRUB: 40 }] } });
const craft = (id: string, output: string, input: string): CraftRecord => ({ id,
    productItemId: output, productCount: 1, stationId: "bench", level: 2, duration: 60,
    requiredItems: [{ itemId: input, count: 1 }], requiredQuestItems: [], gameEditions: [] });

test("nested inaccessible recipes fall back and retain quest/station reasons through unpriced parents", () => {
    const nested = { ...craft("nested", "B", "C"), taskUnlockId: "quest" };
    const parent = craft("parent", "A", "B");
    const input = { itemsById: { A: item("A", 1000), B: { ...item("B"), onFleaMarket: false }, C: item("C", 10) },
        crafts: [parent, nested], barters: [], stationLevels: { bench: 2 } };
    const locked = createRecipeCalculator(input).evaluateNode("A");
    assert.equal(locked.method, "flea");
    assert.equal(locked.lockedAlternatives?.find(r => r.sourceId === "parent")?.lockReasons.some(r => r.questId === "quest"), true);
    assert.equal(createRecipeCalculator({ ...input, completedQuests: { quest: true } }).evaluateNode("A").method, "craft");
    const stationParent = { ...parent, level: 1 };
    const station = createRecipeCalculator({ ...input, crafts: [stationParent, nested], stationLevels: { bench: 1 }, completedQuests: { quest: true } }).evaluateNode("A");
    assert.equal(station.method, "flea");
    assert.equal(station.lockedAlternatives?.find(r => r.sourceId === "parent")?.lockReasons.some(r => r.kind === "station"), true);
    const unavailable = createRecipeCalculator({ ...input, itemsById: { ...input.itemsById, A: { ...item("A"), onFleaMarket: false } } }).evaluateNode("A");
    assert.equal(unavailable.totalCost, null);
    assert.equal(unavailable.lockReasons?.some(r => r.questId === "quest"), true);
    assert.deepEqual(getRecipeLockReasons(parent, {}), []);
    assert.equal(getRecipeLockReasons(parent, { stationLevels: {} })[0].kind, "station");
});

test("level and banned outputs use accessible sales, with opt-out and manual precedence", () => {
    const recipe = craft("output", "A", "B");
    for (const output of [{ ...item("A", 1000), minLevelForFlea: 20 }, { ...item("A", 1000), onFleaMarket: false }]) {
        const input = { itemsById: { A: output, B: item("B", 100) }, crafts: [recipe], barters: [], playerLevel: 14,
            overrides: { B: { buy: 10 } } };
        const sale = createRecipeCalculator(input).evaluateCraft(recipe);
        assert.equal(sale.sellValue, 40);
        assert.equal(sale.sellSourceLabel, "Trader");
        assert.equal(sale.outputLockReasons.length > 0, true);
        assert.equal(sale.inputSellValue, 40);
        const disabled = createRecipeCalculator({ ...input, useTraderSaleForLockedOutputs: false }).evaluateCraft(recipe);
        assert.equal(disabled.sellValue, null);
        assert.equal(disabled.inputSellValue, 40);
        const manual = createRecipeCalculator({ ...input, useTraderSaleForLockedOutputs: false, overrides: { A: { buy: 0, sell: 0 }, B: { buy: 10 } } });
        assert.equal(manual.evaluateCraft(recipe).sellValue, 0);
        assert.equal(manual.evaluateNode("A").totalCost, 0);
    }
    assert.equal(getFleaLockReasons(item("A"), 14).length, 1);
    assert.deepEqual(getFleaLockReasons(item("A"), 15), []);
    assert.equal(getFleaLockReasons({ ...item("A"), minLevelForFlea: 20 }, 19).length, 1);
    assert.deepEqual(getFleaLockReasons({ ...item("A"), minLevelForFlea: 20 }, 20), []);
    assert.equal(getFleaLockReasons({ ...item("A"), onFleaMarket: false }).length, 1);
});

test("locked trader and barter routes remain visible and never win", () => {
    const offer = { traderId: "vendor", minTraderLevel: 2, taskUnlockId: "quest", price: 1, priceRUB: 1, currency: "RUB", currencyItemId: "roubles" };
    const barter = { id: "barter", offeredItemId: "A", offeredCount: 1, traderId: "vendor", minTraderLevel: 2, taskUnlockId: "quest", requiredItems: [{ itemId: "B", count: 1 }] };
    const input = { itemsById: { A: { ...item("A"), buyFromTrader: [offer] }, B: item("B", 1) }, barters: [barter], crafts: [] };
    const plan = createRecipeCalculator(input).evaluateNode("A");
    assert.equal(plan.method, "flea");
    assert.deepEqual(plan.lockedAlternatives?.map(r => r.method), ["trader", "barter"]);
    assert.equal(plan.lockedAlternatives?.every(r => r.lockReasons.length === 2), true);
    assert.equal(createRecipeCalculator({ ...input, traderLoyaltyLevels: { vendor: 2 }, completedQuests: { quest: true } }).evaluateNode("A").totalCost, 1);
});


test("availability reasons show current levels and roubles bypass flea locks", () => {
    const recipe = { ...craft("c", "A", "B"), taskUnlockId: "long-quest-id" };
    assert.deepEqual(getRecipeLockReasons(recipe, { stationLevels: {} }), [
        { kind: "station", message: "Station is lvl 0" },
        { kind: "quest", message: "Complete required quest", questId: "long-quest-id" },
    ]);
    assert.deepEqual(getRecipeLockReasons({ id: "b", offeredItemId: "A", offeredCount: 1,
        traderId: "long-trader-id", minTraderLevel: 3, requiredItems: [] }, {}),
        [{ kind: "vendor", message: "Trader is LL1" }]);
    const roubles = { ...item("roubles"), onFleaMarket: false, minLevelForFlea: 99 };
    assert.deepEqual(getFleaLockReasons(roubles, 1), []);
    const calculator = createRecipeCalculator({ itemsById: { roubles }, crafts: [], barters: [], playerLevel: 1 });
    assert.equal(calculator.evaluateNode("roubles", 12).totalCost, 12);
});

test("lock labels reflect supplied current levels and concise flea requirements", () => {
    assert.equal(getRecipeLockReasons(craft("c", "A", "B"), { stationLevels: { bench: 1 } })[0].message, "Station is lvl 1");
    const barter = { id: "b", offeredItemId: "A", offeredCount: 1, traderId: "vendor", minTraderLevel: 4, requiredItems: [] };
    assert.equal(getRecipeLockReasons(barter, { traderLoyaltyLevels: { vendor: 2 } })[0].message, "Trader is LL2");
    assert.deepEqual(getRecipeLockReasons(barter, { traderLoyaltyLevels: { vendor: 4 } }), []);
    assert.deepEqual(getFleaLockReasons({ ...item("A"), minLevelForFlea: 20 }, 14).map(reason => reason.message), ["Flea unlocks at lvl 20"]);
    for (const playerLevel of [14, 25, 50, undefined]) {
        assert.deepEqual(getFleaLockReasons({ ...item("A"), onFleaMarket: false, minLevelForFlea: 25 }, playerLevel), [{ kind: "flea", message: "Not on flea" }]);
    }
    assert.deepEqual(getFleaLockReasons(undefined, 14), [{ kind: "unavailable", message: "Item data unavailable" }]);
});

test("locked trader price metadata is display-only and rejects invalid estimates", () => {
    for (const price of [1, 0, -1, NaN, Infinity]) {
        const offer = { traderId: "vendor", minTraderLevel: 2, price, priceRUB: price, currency: "RUB", currencyItemId: "roubles" };
        const plan = createRecipeCalculator({ itemsById: { A: { ...item("A", 100), buyFromTrader: [offer] } }, crafts: [], barters: [] }).evaluateNode("A", 3);
        assert.equal(plan.method, "flea");
        assert.equal(plan.totalCost, 300);
        assert.equal(plan.lockedAlternatives?.find(route => route.method === "trader")?.estimatedUnitPrice, price === 1 ? 1 : undefined);
        assert.equal(plan.alternatives.some(route => route.method === "trader"), false);
    }
});

test("locked flea estimates never supply ingredients or win selection", () => {
    const calculator = createRecipeCalculator({ itemsById: { A: { ...item("A", 123), onFleaMarket: false } }, crafts: [], barters: [] });
    const plan = calculator.evaluateNode("A", 3);
    assert.equal(plan.method, "unavailable");
    assert.equal(plan.totalCost, null);
    assert.equal(plan.lockedAlternatives?.find(route => route.method === "flea")?.estimatedUnitPrice, 123);
});

test("locked recipe estimates use eligible ingredients and batch rounding without unlocking routes", () => {
    const lockedCraft = { ...craft("locked-craft", "A", "B"), productCount: 2, taskUnlockId: "quest" };
    const lockedBarter = { id: "locked-barter", offeredItemId: "A", offeredCount: 2, traderId: "vendor", minTraderLevel: 2, requiredItems: [{ itemId: "B", count: 1 }] };
    const nested = craft("nested", "B", "C");
    const input = { itemsById: { A: item("A", 1000), B: { ...item("B"), onFleaMarket: false }, C: item("C", 12) }, crafts: [lockedCraft, nested], barters: [lockedBarter] };
    const plan = createRecipeCalculator(input).evaluateNode("A", 3);
    assert.equal(plan.method, "flea");
    assert.equal(plan.totalCost, 3000);
    for (const method of ["craft", "barter"]) {
        assert.equal(plan.lockedAlternatives?.find(route => route.method === method)?.estimatedUnitPrice, 8);
        assert.equal(plan.alternatives.some(route => route.method === method), false);
    }
    const unavailable = createRecipeCalculator({ ...input, crafts: [lockedCraft, { ...nested, taskUnlockId: "nested-quest" }] }).evaluateNode("A", 3);
    assert.equal(unavailable.lockedAlternatives?.filter(route => route.method === "craft" || route.method === "barter").every(route => route.estimatedUnitPrice === undefined), true);
    assert.equal(unavailable.totalCost, 3000);
});


test("root unknown production and quest-item costs carry unavailable reasons", () => {
    for (const recipe of [
        { ...craft("empty", "A", "B"), requiredItems: [] },
        { ...craft("quest-input", "A", "B"), requiredQuestItems: [{ itemId: "quest-item", count: 1 }] },
        { ...craft("both", "A", "B"), requiredItems: [], requiredQuestItems: [{ itemId: "quest-item", count: 1 }] },
    ]) {
        const evaluation = createRecipeCalculator({ itemsById: { A: item("A"), B: item("B") }, crafts: [recipe], barters: [] }).evaluateCraft(recipe);
        assert.equal(evaluation.cost, null);
        assert.equal(evaluation.profit, null);
        assert.equal(evaluation.lockReasons.length, recipe.id === "both" ? 2 : 1);
        assert.equal(evaluation.lockReasons.every(r => r.kind === "unavailable" && r.questId === undefined), true);
    }
});

test("propagated diagnostics deduplicate shared reasons without merging distinct quests", () => {
    const leaf = (id: string, output: string, quest: string) => ({ ...craft(id, output, "D"), taskUnlockId: quest });
    const parent = { ...craft("parent", "A", "B"), requiredItems: [{ itemId: "B", count: 1 }, { itemId: "C", count: 1 }] };
    const calculator = createRecipeCalculator({
        itemsById: Object.fromEntries(["A", "B", "C", "D"].map(id => [id, { ...item(id), onFleaMarket: false }])),
        crafts: [parent, leaf("b1", "B", "q1"), leaf("b2", "B", "q1"), leaf("c1", "C", "q1"), leaf("c2", "C", "q2")], barters: [],
    });
    const plan = calculator.evaluateNode("A");
    assert.equal(plan.method, "unavailable");
    const propagated = plan.lockedAlternatives?.find(r => r.sourceId === "parent")?.lockReasons ?? [];
    assert.deepEqual(propagated.filter(r => r.kind === "quest").map(r => r.questId), ["q1", "q2"]);
    for (const reasons of [plan.lockReasons ?? [], propagated]) {
        const keys = reasons.map(r => JSON.stringify([r.kind, r.message, r.questId]));
        assert.equal(new Set(keys).size, keys.length);
        assert.equal(reasons.filter(r => r.message === "No accessible priced acquisition route").length, 1);
    }
});
