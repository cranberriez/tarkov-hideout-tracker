import assert from "node:assert/strict";
import test from "node:test";
import type {
  AcquisitionPlan,
  RecipeEvaluation,
} from "@/lib/price-calculation";
import {
  acquisitionRouteKey,
  compareEvaluations,
  describeRoute,
  getPlanRecipePreview,
  hasRecipeRoute,
  withRequiredItemRoute,
} from "./recipes";

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
  assert.equal(switched.profit, 380);
  assert.equal(switched.durationSeconds, 4_200);
  assert.equal(switched.profitPerHour, 380 / (4_200 / 3_600));
  assert.deepEqual(
    switched.requiredItems[0].alternatives.map((route) => route.method),
    ["trader", "flea"],
  );
});
