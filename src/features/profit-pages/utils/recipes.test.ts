import assert from "node:assert/strict";
import test from "node:test";
import type {
  AcquisitionPlan,
  RecipeEvaluation,
} from "@/lib/price-calculation";
import {
  passesLockFilters,
  acquisitionRouteKey,
  compareEvaluations,
  compareEvaluationsByBaseline,
  describeRoute,
  getPlanRecipePreview,
  hasRecipeRoute,
  hasCheaperLockedRoute,
  withRequiredItemRoute,
} from "./recipes";

test("fallback indicator requires a cheaper priced locked route, with practical recipe savings", () => {
  const plan: AcquisitionPlan = {
    itemId: "input", quantity: 2, method: "trader", batches: 1,
    totalCost: 200, theoreticalCost: 200, theoreticalMethod: "trader",
    directBuyCost: 200, directBuyMethod: "trader", durationSeconds: 0,
    children: [], alternatives: [],
  };
  assert.equal(hasCheaperLockedRoute(plan), false);
  for (const estimate of [undefined, NaN, -1, 100, 120]) {
    assert.equal(hasCheaperLockedRoute({ ...plan, lockedAlternatives: [
      { method: "flea", estimatedUnitPrice: estimate, lockReasons: [] },
    ] }), false);
  }
  const locked = (method: "flea" | "craft", estimatedUnitPrice: number) => ({
    ...plan, lockedAlternatives: [{ method, estimatedUnitPrice, lockReasons: [] }],
  });
  assert.equal(hasCheaperLockedRoute(locked("flea", 99)), true);
  assert.equal(hasCheaperLockedRoute(locked("craft", 95)), false);
  assert.equal(hasCheaperLockedRoute(locked("craft", 94)), true);
  assert.equal(hasCheaperLockedRoute(locked("flea", 0)), true);
  assert.equal(hasCheaperLockedRoute({ ...locked("flea", 0), totalCost: null }), false);
  assert.equal(hasCheaperLockedRoute({ ...locked("flea", 0), method: "unavailable" }), false);
});

function evaluation(
  id: string,
  values: Partial<
    Pick<RecipeEvaluation, "cost" | "sellValue" | "profit" | "profitPerHour">
  >,
): RecipeEvaluation {
  return {
    id,
    kind: "craft",
    outputItemId: id,
    outputCount: 1,
    requiredItems: [],
    cost: null,
    theoreticalCost: null,
    sellValue: null,
    profit: null,
    inputSellValue: null,
    profitVsSellingInputs: null,
    durationSeconds: 0,
    profitPerHour: null,
    directBuyCost: null,
    directBuyMethod: null,
    isPracticallyWorthwhile: null,
    ...values,
  };
}

test("profit table metrics sort in either direction with unknown values last", () => {
  const low = evaluation("low", {
    cost: 100,
    sellValue: 200,
    profit: 50,
    profitPerHour: 25,
  });
  const high = evaluation("high", {
    cost: 300,
    sellValue: 600,
    profit: 250,
    profitPerHour: 125,
  });
  const unknown = evaluation("unknown", {});
  const itemsById = {
    low: { id: "low", name: "Low", normalizedName: "low" },
    high: { id: "high", name: "High", normalizedName: "high" },
    unknown: { id: "unknown", name: "Unknown", normalizedName: "unknown" },
  };

  for (const sortKey of [
    "cost",
    "sellValue",
    "profit",
    "profitPerHour",
  ] as const) {
    assert.deepEqual(
      [high, unknown, low]
        .sort((left, right) =>
          compareEvaluations(left, right, sortKey, "ascending", itemsById),
        )
        .map(({ id }) => id),
      ["low", "high", "unknown"],
    );
    assert.deepEqual(
      [low, unknown, high]
        .sort((left, right) =>
          compareEvaluations(left, right, sortKey, "descending", itemsById),
        )
        .map(({ id }) => id),
      ["high", "low", "unknown"],
    );
  }
});

test("trader routes are described as purchases and never expose recipe navigation", () => {
  const plan: AcquisitionPlan = {
    itemId: "item-a",
    quantity: 2,
    method: "trader",
    sourceId: "trader:item-a:0",
    traderOffer: {
      traderId: "peacekeeper",
      price: 53,
      priceRUB: 6_625,
      currency: "USD",
      currencyItemId: "dollars",
      minTraderLevel: 2,
      taskUnlockId: "quest-a",
      buyLimit: 3,
    },
    batches: 1,
    totalCost: 13_250,
    theoreticalCost: 13_250,
    theoreticalMethod: "trader",
    directBuyCost: 13_250,
    directBuyMethod: "trader",
    durationSeconds: 0,
    children: [],
    alternatives: [],
  };
  const context = {
    itemById: {},
    bartersById: {},
    craftsById: {},
    tradersById: {
      peacekeeper: { id: "peacekeeper", name: "Peacekeeper", normalizedName: "peacekeeper" },
    },
    stationsById: {},
  };

  assert.equal(hasRecipeRoute(plan), false);
  assert.equal(getPlanRecipePreview(plan, context), undefined);
  assert.match(describeRoute(plan, context), /Peacekeeper at LL2/);
  assert.match(describeRoute(plan, context), /53 USD/);
  assert.match(describeRoute(plan, context), /quest unlock required/);
  assert.match(describeRoute(plan, context), /limit 3/);
});

test("row-local ingredient routes recalculate totals without mutating the base evaluation", () => {
  const plan: AcquisitionPlan = {
    itemId: "item-a",
    quantity: 2,
    method: "flea",
    batches: 1,
    totalCost: 200,
    selectedRouteTheoreticalCost: 200,
    theoreticalCost: 120,
    theoreticalMethod: "craft",
    directBuyCost: 180,
    directBuyMethod: "trader",
    durationSeconds: 0,
    children: [],
    alternatives: [
      {
        method: "trader",
        sourceId: "trader:item-a:0",
        batches: 1,
        totalCost: 180,
        theoreticalCost: 180,
        durationSeconds: 0,
        children: [],
      },
      {
        method: "craft",
        sourceId: "craft-a",
        batches: 1,
        totalCost: 120,
        theoreticalCost: 120,
        durationSeconds: 600,
        children: [],
      },
    ],
  };
  const evaluation = {
    id: "root-craft",
    kind: "craft" as const,
    outputItemId: "output",
    outputCount: 1,
    requiredItems: [plan],
    cost: 200,
    theoreticalCost: 120,
    sellValue: 500,
    sellValueIsEstimate: true,
    profit: 300,
    inputSellValue: 200,
    profitVsSellingInputs: 300,
    durationSeconds: 3_600,
    profitPerHour: 300,
    directBuyCost: 500,
    directBuyMethod: "flea" as const,
    isPracticallyWorthwhile: true,
    craft: {
      id: "root-craft",
      productItemId: "output",
      productCount: 1,
      stationId: "workbench",
      level: 1,
      duration: 3_600,
      requiredItems: [{ itemId: "item-a", count: 2 }],
      requiredQuestItems: [],
      gameEditions: [],
    },
  };

  const switched = withRequiredItemRoute(
    evaluation,
    0,
    acquisitionRouteKey(plan.alternatives[1]),
  );

  assert.equal(evaluation.requiredItems[0].method, "flea");
  assert.equal(switched.requiredItems[0].method, "craft");
  assert.equal(switched.cost, 120);
  assert.equal(switched.sellValue, 500);
  assert.equal(switched.sellValueIsEstimate, true);
  assert.equal(switched.profit, 380);
  assert.equal(switched.durationSeconds, 4_200);
  assert.equal(switched.profitPerHour, 380 / (4_200 / 3_600));
  assert.deepEqual(
    switched.requiredItems[0].alternatives.map((route) => route.method),
    ["trader", "flea"],
  );
});

test("customized evaluations retain their baseline sort order", () => {
  const baselineLow = evaluation("low", { profitPerHour: 25 });
  const baselineHigh = evaluation("high", { profitPerHour: 125 });
  const customizedLow = evaluation("low", { profitPerHour: 500 });
  const customizedHigh = evaluation("high", { profitPerHour: 10 });
  const itemsById = {
    low: { id: "low", name: "Low", normalizedName: "low" },
    high: { id: "high", name: "High", normalizedName: "high" },
  };

  assert.deepEqual(
    [customizedLow, customizedHigh]
      .sort((left, right) =>
        compareEvaluationsByBaseline(
          left,
          right,
          "profitPerHour",
          "descending",
          itemsById,
          { low: baselineLow, high: baselineHigh },
        ),
      )
      .map(({ id }) => id),
    ["high", "low"],
  );
});

test("locked ingredient routes can be inspected without becoming automatic candidates", () => {
  const lockedChild: AcquisitionPlan = {
    itemId: "child",
    quantity: 1,
    method: "flea",
    batches: 1,
    totalCost: 75,
    theoreticalCost: 75,
    theoreticalMethod: "flea",
    directBuyCost: 75,
    directBuyMethod: "flea",
    durationSeconds: 0,
    children: [],
    alternatives: [],
  };
  const plan: AcquisitionPlan = {
    itemId: "input",
    quantity: 2,
    method: "flea",
    batches: 1,
    totalCost: 200,
    theoreticalCost: 150,
    theoreticalMethod: "craft",
    directBuyCost: 200,
    directBuyMethod: "flea",
    durationSeconds: 0,
    children: [],
    alternatives: [],
    lockedAlternatives: [{
      method: "craft",
      sourceId: "locked-craft",
      estimatedUnitPrice: 75,
      lockReasons: [{ kind: "station", message: "Requires level 2" }],
      batches: 1,
      durationSeconds: 600,
      children: [lockedChild],
    }],
  };

  const selected = withRequiredItemRoute(
    { ...evaluation("root", { sellValue: 500 }), requiredItems: [plan] },
    0,
    "craft:locked-craft",
  );
  const selectedPlan = selected.requiredItems[0];

  assert.equal(selectedPlan.method, "craft");
  assert.equal(selectedPlan.totalCost, 150);
  assert.equal(selectedPlan.durationSeconds, 600);
  assert.deepEqual(selectedPlan.children, [lockedChild]);
  assert.deepEqual(selectedPlan.lockReasons, [
    { kind: "station", message: "Requires level 2" },
  ]);
  assert.equal(selected.cost, 150);
  assert.equal(selected.profit, 350);
  assert.deepEqual(selectedPlan.alternatives.map(acquisitionRouteKey), ["flea:direct"]);
});

 test("lock filters independently include recipe, output and unavailable input reasons", () => {
 const row = evaluation("locked", {});
 const filters = { flea: false, quest: false, vendor: false, station: false };
 assert.equal(passesLockFilters(row, true, filters), true);
 for (const kind of ["flea", "quest", "vendor", "station"] as const) {
   row.lockReasons = [{ kind, message: "Locked" }];
   assert.equal(passesLockFilters(row, false, filters), true);
   assert.equal(passesLockFilters(row, true, filters), false);
   assert.equal(passesLockFilters(row, false, { ...filters, [kind]: true }), false);
 }
 row.lockReasons = [];
 row.outputLockReasons = [{ kind: "flea", message: "No flea sale" }];
 assert.equal(passesLockFilters(row, true, filters), false);
 assert.equal(passesLockFilters(row, false, { ...filters, flea: true }), false);
 row.outputLockReasons = [];
 row.requiredItems = [{ method: "unavailable", children: [] } as unknown as AcquisitionPlan];
 assert.equal(passesLockFilters(row, true, filters), false);
 assert.equal(passesLockFilters(row, false, filters), true);
 row.requiredItems = [{ method: "unavailable", children: [], lockReasons: [{ kind: "flea", message: "Cannot buy ingredient" }] } as unknown as AcquisitionPlan];
 assert.equal(passesLockFilters(row, false, { ...filters, flea: true }), true);
 assert.equal(passesLockFilters(row, true, filters), false);
 });
