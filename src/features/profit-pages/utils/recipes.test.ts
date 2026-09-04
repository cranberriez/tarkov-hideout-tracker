import assert from "node:assert/strict";
import test from "node:test";
import type { AcquisitionPlan } from "@/lib/price-calculation";
import { describeRoute, getPlanRecipePreview, hasRecipeRoute } from "./recipes";

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
