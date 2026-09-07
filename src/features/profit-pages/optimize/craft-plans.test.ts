import assert from "node:assert/strict";
import test from "node:test";
import type { RecipeCalculatorInput } from "../../../lib/price-calculation/types";
import { buildContinuousSession, buildCraftSession, craftWindowProfitHour, getCraftPlans, placeCraftPlan, recommendCraftPlans, selectStationPlans, toggleStationPlan, type CraftPlan, type CraftStep } from "./craft-plans";
import { getSeasonalCraftingSettings, SEASONAL_CONFIG } from "../../../lib/cfg/seasonal";

function input(): RecipeCalculatorInput {
  return {
    playerLevel: 30, stationLevels: { med: 3, bench: 3, lav: 3 }, barters: [],
    itemsById: Object.fromEntries([["A", 10000], ["B", 5000], ["C", 100]].map(([id, price]) => [id, {
      id: String(id), normalizedName: String(id), name: String(id), onFleaMarket: true, marketPrice: { price: Number(price) },
    }])),
    crafts: [
      { id: "root", productItemId: "A", productCount: 1, stationId: "med", level: 1, duration: 7200,
        requiredItems: [{ itemId: "B", count: 3 }], requiredQuestItems: [], gameEditions: [] },
      { id: "supply", productItemId: "B", productCount: 2, stationId: "bench", level: 1, duration: 5400,
        requiredItems: [{ itemId: "C", count: 1 }], requiredQuestItems: [], gameEditions: [] },
    ],
  };
}
const step = (id: string, stationId: string, duration: number, after: string[] = []): CraftStep =>
  ({ id, stationId, duration, after, recipeId: id, itemId: id, name: id, count: 1 });
const plan = (id: string, steps: CraftStep[]): CraftPlan => ({ id, rootRecipeId: id, name: id, stationId: steps.at(-1)!.stationId,
  itemId: id, count: 1, duration: steps.reduce((sum, step) => sum + step.duration, 0), cost: 100, profit: 200,
  steps, shopping: [], hasChain: steps.length > 1 });

test("craft chains charge full batches and schedule full durations instead of amortized time", () => {
  const result = getCraftPlans(input(), true);
  const root = result.plans.find(plan => plan.rootRecipeId === "root")!;
  assert.equal(root.hasChain, true);
  assert.equal(root.steps.length, 3);
  assert.equal(root.duration, 5 * 3600); // Two 90-minute batches, then two hours.
  assert.equal(root.cost, 200);
  assert.equal(root.profit, 9800);
  assert.deepEqual(root.shopping, [{ itemId: "C", name: "C", count: 2, cost: 200 }]);
  const bookings = placeCraftPlan(root, [], 2)!;
  assert.equal(bookings[1].start, bookings[0].finish, "same recipe cannot use both Elite slots concurrently");
  assert.equal(bookings.at(-1)!.start, bookings[1].finish);
});

test("skill-adjusted sub-crafts are applied once and direct-only excludes the chain", () => {
  const data = input(); data.craftingSkillLevel = 50;
  const root = getCraftPlans(data, true).plans.find(plan => plan.rootRecipeId === "root")!;
  assert.equal(root.duration, 5 * 3600 * 0.625);
  assert.ok(getCraftPlans(data, false).plans.every(plan => !plan.hasChain));
  assert.ok(!getCraftPlans(data, false).plans.some(plan => plan.rootRecipeId === "root"));
});

test("manual prices apply but never bypass flea locks", () => {
  const data = input();
  data.overrides = { B: { buy: 10 }, A: { sell: 20000 } };
  const root = getCraftPlans(data, false).plans.find(plan => plan.rootRecipeId === "root")!;
  assert.equal(root.profit, 19970);
  data.itemsById.B.onFleaMarket = false;
  assert.ok(!getCraftPlans(data, false).plans.some(plan => plan.rootRecipeId === "root"));
});

test("disabled barters, sell-value fallback, locked sub-crafts and unpriced tools cannot supply plans", () => {
  for (const variant of ["barter", "fallback", "locked", "tool"]) {
    const data = input();
    if (variant === "tool") data.crafts[0].requiredItems.push({ itemId: "missing", count: 1, isTool: true });
    else {
      data.itemsById.B.onFleaMarket = false;
      if (variant === "locked") data.crafts[1].taskUnlockId = "locked-task";
      else data.crafts = data.crafts.slice(0, 1);
      if (variant === "barter") data.barters = [{ id: "barter", offeredItemId: "B", offeredCount: 3, traderId: "vendor", minTraderLevel: 1, requiredItems: [{ itemId: "C", count: 1 }] }];
    }
    assert.ok(!getCraftPlans(data, true, { traders: true, barters: false }).plans.some(plan => plan.rootRecipeId === "root"), variant);
  }
});

test("crafted intermediate items need not be flea-sellable, final outputs do", () => {
  const data = input(); data.itemsById.B.onFleaMarket = false;
  assert.ok(getCraftPlans(data, true).plans.some(plan => plan.rootRecipeId === "root"));
  data.itemsById.A.onFleaMarket = false;
  assert.ok(!getCraftPlans(data, true).plans.some(plan => plan.rootRecipeId === "root"));
});

test("independent sub-crafts run in parallel, same-station steps serialize", () => {
  const chain = plan("chain", [step("a", "bench", 100), step("b", "lav", 200), step("root", "med", 50, ["a", "b"])]);
  assert.equal(placeCraftPlan(chain)!.at(-1)!.finish, 250);
  chain.steps[1].stationId = "bench";
  assert.equal(placeCraftPlan(chain)!.at(-1)!.finish, 350);
  assert.equal(placeCraftPlan(chain, [], 2)!.at(-1)!.finish, 250);
});

test("combined session reserves supplier stations and fills their earlier free gaps", () => {
  const chain = plan("chain", [step("a", "lav", 100), step("b", "bench", 100, ["a"]), step("root", "med", 100, ["b"])]);
  const filler = plan("filler", [step("filler", "bench", 80)]);
  const session = buildCraftSession([filler, chain]);
  assert.equal(session.find(booking => booking.planId === "filler")!.start, 0);
  const extra = plan("extra", [step("extra", "bench", 150)]);
  const extended = buildCraftSession([chain, extra]);
  assert.equal(extended.find(booking => booking.planId === "extra")!.start, 200);
  for (const a of extended) for (const b of extended) {
    if (a === b || a.step.stationId !== b.step.stationId || a.lane !== b.lane) continue;
    assert.ok(a.finish <= b.start || b.finish <= a.start);
  }
});



test("recommendations compare complete chain time and show each recipe once", () => {
  const direct = plan("root:buy", [step("root", "med", 50)]); direct.rootRecipeId = "root";
  const chain = plan("root:chain", [step("b", "bench", 50), step("root", "med", 50, ["b"])]); chain.rootRecipeId = "root";
  const groups = recommendCraftPlans([direct, chain], "target", 100);
  assert.equal(groups.get("med")!.length, 1);
  assert.equal(groups.get("med")![0].id, "root:chain");
});



test("hourly profit includes idle time and return windows change profit recommendations", () => {
  const short = plan("short", [step("short", "bench", 1800)]); short.profit = 1000;
  const long = plan("long", [step("long", "bench", 3600)]); long.profit = 1500;
  assert.equal(craftWindowProfitHour(short.profit, short.duration, 3600), 1000);
  assert.equal(craftWindowProfitHour(short.profit, short.duration, 1800), 2000);
  assert.equal(recommendCraftPlans([short, long], "profit-hour", 1800).get("bench")![0].id, "short");
  assert.equal(recommendCraftPlans([short, long], "profit-hour", 3600).get("bench")![0].id, "long");
  assert.equal(craftWindowProfitHour(3000, 7200, 3600), 1500, "long chains use complete elapsed time");
});

test("Elite defaults to two distinct sale crafts and toggles respect capacity and selection order", () => {
  const available = ["a", "b", "c"].map(id => plan(id, [step(id, "bench", 3600)]));
  assert.equal(selectStationPlans(available, undefined, 1).length, 1);
  assert.deepEqual(selectStationPlans(available, undefined, 2).map(plan => plan.id), ["a", "b"]);
  let choice = toggleStationPlan(["a", "b"], "c", 2);
  assert.deepEqual(choice, ["b", "c"]);
  assert.deepEqual(selectStationPlans(available, choice, 2).map(plan => plan.id), choice);
  choice = toggleStationPlan(choice, "b", 2);
  assert.deepEqual(choice, ["c"]);
  assert.deepEqual(toggleStationPlan(choice, null, 2), []);
  assert.deepEqual(selectStationPlans(available, [], 2), []);
  const skill = getSeasonalCraftingSettings(SEASONAL_CONFIG.mode, 0).craftingSkillLevel;
  const session = buildCraftSession(selectStationPlans(available, undefined, skill >= 51 ? 2 : 1), 2);
  assert.equal(session.length, 2);
  assert.ok(session.every(booking => booking.start === 0));
  assert.equal(new Set(session.map(booking => booking.lane)).size, 2);
});

test("displayed profit matches full flea shopping costs and final sale quantities", () => {
  const data = input();
  data.crafts[0].productCount = 3;
  data.overrides = { A: { sell: 12000 }, B: { buy: 4000 } };
  const plans = getCraftPlans(data, true).plans;
  for (const plan of plans) {
    assert.equal(plan.cost, plan.shopping.reduce((sum, item) => sum + item.cost, 0));
    if (plan.rootRecipeId === "root") assert.equal(plan.profit + plan.cost, 36000);
  }
});


test("trader inputs restore profitable crafts and obey loyalty, quest locks and source switches", () => {
  const data = input(); data.crafts = data.crafts.slice(0, 1);
  data.itemsById.B.onFleaMarket = false;
  data.itemsById.B.buyFromTrader = [{ traderId: "vendor", price: 100, priceRUB: 100, currency: "RUB", currencyItemId: "roubles", minTraderLevel: 2, taskUnlockId: "unlock" }];
  data.traderLoyaltyLevels = { vendor: 2 }; data.completedQuests = { unlock: true };
  const root = getCraftPlans(data, false).plans[0];
  assert.equal(root.cost, 300);
  assert.equal(root.profit, 9700);
  assert.equal(root.shopping[0].traderId, "vendor");
  assert.equal(root.duration, 7200);
  assert.equal(getCraftPlans(data, false, { traders: false, barters: true }).plans.length, 0);
  data.completedQuests = {};
  assert.equal(getCraftPlans(data, false).plans.length, 0);
  data.completedQuests = { unlock: true }; data.traderLoyaltyLevels = { vendor: 1 };
  assert.equal(getCraftPlans(data, false).plans.length, 0);
});

test("barters charge rounded ingredient batches without station time and enforce unlocks", () => {
  const data = input(); data.crafts = data.crafts.slice(0, 1);
  data.itemsById.B.onFleaMarket = false;
  data.barters = [{ id: "exchange", offeredItemId: "B", offeredCount: 2, traderId: "vendor", minTraderLevel: 2, taskUnlockId: "unlock", requiredItems: [{ itemId: "C", count: 2 }] }];
  data.traderLoyaltyLevels = { vendor: 2 }; data.completedQuests = { unlock: true };
  const root = getCraftPlans(data, false).plans[0];
  assert.equal(root.cost, 400);
  assert.equal(root.shopping[0].count, 4);
  assert.equal(root.exchanges![0].count, 4);
  assert.equal(root.duration, 7200);
  assert.equal(root.steps.length, 1);
  assert.equal(getCraftPlans(data, false, { traders: true, barters: false }).plans.length, 0);
  data.completedQuests = {};
  assert.equal(getCraftPlans(data, false).plans.length, 0);
  data.completedQuests = { unlock: true }; data.traderLoyaltyLevels = { vendor: 1 };
  assert.equal(getCraftPlans(data, false).plans.length, 0);
});

test("crafts supplying barters retain their full duration and consuming craft dependency", () => {
  const data = input();
  data.itemsById.B.onFleaMarket = false;
  data.itemsById.D = { id: "D", name: "D", normalizedName: "d", onFleaMarket: true, marketPrice: { price: 20 } };
  data.crafts[1] = { ...data.crafts[1], productItemId: "C", productCount: 4, requiredItems: [{ itemId: "D", count: 1 }] };
  data.barters = [{ id: "exchange", offeredItemId: "B", offeredCount: 3, traderId: "vendor", minTraderLevel: 1, requiredItems: [{ itemId: "C", count: 3 }] }];
  const root = getCraftPlans(data, true).plans.find(plan => plan.rootRecipeId === "root" && plan.hasChain)!;
  assert.equal(root.cost, 20);
  assert.equal(root.duration, 12600);
  assert.deepEqual(root.steps.at(-1)!.after, [root.steps[0].id]);
  assert.deepEqual(root.exchanges![0].after, [root.steps[0].id]);
  assert.equal(root.shopping.reduce((sum, item) => sum + item.cost, 0), root.cost);
});


test("continuous crafts restart independently of a slower station", () => {
  const fast = plan("fast", [step("fast", "bench", 1800)]);
  const slow = plan("slow", [step("slow", "med", 7200)]);
  const result = buildContinuousSession([fast, slow], 1, 7200);
  assert.deepEqual(result.counts, { fast: 4, slow: 1 });
  assert.deepEqual(result.bookings.filter(job => job.planId === "fast").map(job => job.start), [0, 1800, 3600, 5400]);
  assert.equal(result.profit, 1000);
});

test("continuous chains preserve batch dependencies, reservations and Elite recipe exclusion", () => {
  const chain = plan("chain", [step("supply", "bench", 600), step("output", "med", 1200, ["supply"])]);
  const sale = plan("sale", [{ ...step("supply", "bench", 600), recipeId: "supply" }]);
  const other = plan("other", [step("other", "bench", 900)]);
  for (const slots of [1, 2]) {
    const result = buildContinuousSession([chain, sale, other], slots, 7200);
    assert.ok(result.counts.chain > 1);
    for (const job of result.bookings) {
      assert.ok(job.finish <= 7200);
      for (const dependency of job.step.after) {
        const supplier = result.bookings.find(parent => parent.planId === job.planId && parent.round === job.round && parent.step.id === dependency)!;
        assert.ok(supplier.finish <= job.start);
      }
      for (const other of result.bookings) {
        if (job === other || job.step.stationId !== other.step.stationId) continue;
        if (job.lane === other.lane || job.step.recipeId === other.step.recipeId) assert.ok(job.finish <= other.start || other.finish <= job.start);
      }
    }
    assert.equal(result.profit, Object.values(result.counts).reduce((sum, count) => sum + count * 200, 0));
  }
});

test("continuous day limits exclude incomplete chains and report work limits explicitly", () => {
  const huge = plan("huge", [step("supply", "bench", 100), step("output", "med", 90000, ["supply"])]);
  assert.deepEqual(buildContinuousSession([huge]).bookings, []);
  const fast = plan("fast", [step("fast", "bench", 1)]);
  const result = buildContinuousSession([fast], 1, 100, 10);
  assert.equal(result.truncated, true);
  assert.equal(result.counts.fast, 10);
  assert.equal(result.profit, 2000);
  assert.equal(buildContinuousSession([]).profit, 0);
});
