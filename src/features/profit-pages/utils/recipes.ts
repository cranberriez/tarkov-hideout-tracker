import type {
  AcquisitionAlternative,
  AcquisitionPlan,
  RecipeEvaluation,
} from "@/lib/price-calculation";
import { practicalSavingsThreshold } from "../../../lib/price-calculation/prices";
import type { ItemSummary } from "@/types/items";
import type {
  RecipePreviewData,
  RouteContext,
  SortDirection,
  SortKey,
} from "../types";
import { formatDuration } from "./formatters";

export function indexByOutput<T>(
  records: T[],
  getItemId: (record: T) => string,
) {
  const index: Record<string, T[]> = Object.create(null) as Record<string, T[]>;
  for (const record of records) (index[getItemId(record)] ??= []).push(record);
  return index;
}

export function getRecipeSourceId(evaluation: RecipeEvaluation) {
  return evaluation.barter?.traderId ?? evaluation.craft?.stationId ?? "";
}

export function profitGrid() {
  return "grid-cols-[40px_125px_170px_minmax(300px,1fr)_110px_150px_120px_120px]";
}

export function estimateProfitRowHeight(evaluation?: RecipeEvaluation) {
  if (!evaluation) return 72;
  return Math.max(72, evaluation.requiredItems.length * 36 + 4) + 1;
}

export function isRecipeAvailable(
  evaluation: RecipeEvaluation,
  stationLevels: Record<string, number>,
  traderLevels: Record<string, number>,
  completedQuests: Record<string, boolean>,
) {
  if (evaluation.barter) {
    return (
      (traderLevels[evaluation.barter.traderId] ?? 1) >=
        evaluation.barter.minTraderLevel &&
      (!evaluation.barter.taskUnlockId ||
        completedQuests[evaluation.barter.taskUnlockId] === true)
    );
  }
  if (evaluation.craft) {
    return (
      (stationLevels[evaluation.craft.stationId] ?? 0) >=
        evaluation.craft.level &&
      (!evaluation.craft.taskUnlockId ||
        completedQuests[evaluation.craft.taskUnlockId] === true)
    );
  }
  return false;
}

export function compareEvaluations(
  left: RecipeEvaluation,
  right: RecipeEvaluation,
  sortKey: SortKey,
  sortDirection: SortDirection,
  itemsById: Readonly<Record<string, ItemSummary>>,
) {
  const leftValue =
    sortKey === "cost"
      ? left.cost
      : sortKey === "sellValue"
        ? left.sellValue
        : sortKey === "profitPerHour"
        ? left.profitPerHour
        : left.profit;
  const rightValue =
    sortKey === "cost"
      ? right.cost
      : sortKey === "sellValue"
        ? right.sellValue
        : sortKey === "profitPerHour"
        ? right.profitPerHour
        : right.profit;
  if (leftValue === null && rightValue !== null) return 1;
  if (leftValue !== null && rightValue === null) return -1;
  if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
    return sortDirection === "ascending"
      ? leftValue - rightValue
      : rightValue - leftValue;
  }
  const nameComparison = (
    itemsById[left.outputItemId]?.name ?? left.outputItemId
  ).localeCompare(itemsById[right.outputItemId]?.name ?? right.outputItemId);
  return nameComparison || left.id.localeCompare(right.id);
}

export function hasRecipeRoute(plan: AcquisitionPlan): boolean {
  return (
    plan.method === "barter" ||
    plan.method === "craft" ||
    plan.children.some(hasRecipeRoute)
  );
}

function planCandidate(plan: AcquisitionPlan): AcquisitionAlternative | null {
  if (plan.method === "unavailable" || plan.totalCost === null) return null;
  return {
    method: plan.method,
    sourceId: plan.sourceId,
    traderOffer: plan.traderOffer,
    batches: plan.batches,
    totalCost: plan.totalCost,
    theoreticalCost: plan.selectedRouteTheoreticalCost ?? plan.totalCost,
    durationSeconds: plan.durationSeconds,
    children: plan.children,
  };
}

export function acquisitionRouteKey(
  route: { method: string; sourceId?: string },
) {
  return `${route.method}:${route.sourceId ?? "direct"}`;
}

export function getAcquisitionRoutes(plan: AcquisitionPlan) {
  const current = planCandidate(plan);
  return [...(current ? [current] : []), ...plan.alternatives].sort(
    (left, right) => left.totalCost - right.totalCost,
  );
}

export function selectAcquisitionRoute(
  plan: AcquisitionPlan,
  routeKey: string,
): AcquisitionPlan {
  const candidates = getAcquisitionRoutes(plan);
  const selected = candidates.find(
    (candidate) => acquisitionRouteKey(candidate) === routeKey,
  );
  if (!selected || acquisitionRouteKey(plan) === routeKey) return plan;
  const direct = candidates
    .filter(
      (candidate) =>
        candidate.method === "flea" || candidate.method === "trader",
    )
    .sort((left, right) => left.totalCost - right.totalCost)[0];
  return {
    ...plan,
    method: selected.method,
    sourceId: selected.sourceId,
    traderOffer: selected.traderOffer,
    batches: selected.batches,
    totalCost: selected.totalCost,
    selectedRouteTheoreticalCost: selected.theoreticalCost,
    durationSeconds: selected.durationSeconds,
    children: selected.children,
    directBuyCost: direct?.totalCost ?? null,
    directBuyMethod:
      direct?.method === "flea" || direct?.method === "trader"
        ? direct.method
        : null,
    alternatives: candidates.filter(
      (candidate) => acquisitionRouteKey(candidate) !== routeKey,
    ),
  };
}

export function withRequiredItemRoute(
  evaluation: RecipeEvaluation,
  requirementIndex: number,
  routeKey: string,
): RecipeEvaluation {
  const requiredItems = evaluation.requiredItems.map((plan, index) =>
    index === requirementIndex ? selectAcquisitionRoute(plan, routeKey) : plan,
  );
  let cost = 0;
  for (const plan of requiredItems) {
    if (plan.isTool) continue;
    if (plan.totalCost === null) {
      cost = Number.NaN;
      break;
    }
    cost += plan.totalCost;
  }
  const resolvedCost = Number.isNaN(cost) ? null : cost;
  const profit =
    resolvedCost === null || evaluation.sellValue === null
      ? null
      : evaluation.sellValue - resolvedCost;
  const durationSeconds =
    (evaluation.kind === "craft" ? (evaluation.craft?.duration ?? 0) : 0) +
    requiredItems.reduce(
      (total, plan) => total + (plan.isTool ? 0 : plan.durationSeconds),
      0,
    );
  const profitPerHour =
    profit === null || durationSeconds <= 0
      ? null
      : profit / (durationSeconds / 3_600);
  const savings =
    evaluation.directBuyCost === null || resolvedCost === null
      ? null
      : evaluation.directBuyCost - resolvedCost;
  return {
    ...evaluation,
    requiredItems,
    cost: resolvedCost,
    profit,
    durationSeconds,
    profitPerHour,
    isPracticallyWorthwhile:
      savings === null || evaluation.directBuyCost === null
        ? null
        : savings > practicalSavingsThreshold(evaluation.directBuyCost),
  };
}

export function getPlanRecipePreview(
  plan: AcquisitionPlan | undefined,
  context: RouteContext,
): RecipePreviewData | undefined {
  if (!plan?.sourceId || (plan.method !== "barter" && plan.method !== "craft"))
    return undefined;
  if (plan.method === "barter") {
    const barter = context.bartersById[plan.sourceId];
    if (!barter) return undefined;
    return {
      kind: "barter",
      sourceId: barter.id,
      outputItemId: barter.offeredItemId,
      outputCount: barter.offeredCount,
      batches: plan.batches,
      requiredItems: plan.children,
      durationSeconds: plan.durationSeconds,
    };
  }
  const craft = context.craftsById[plan.sourceId];
  if (!craft) return undefined;
  return {
    kind: "craft",
    sourceId: craft.id,
    outputItemId: craft.productItemId,
    outputCount: craft.productCount,
    batches: plan.batches,
    requiredItems: plan.children,
    durationSeconds: craft.duration,
  };
}

export function describeRoute(plan: AcquisitionPlan, context: RouteContext) {
  if (plan.isTool)
    return `Reusable tool acquired via ${plan.method}; its value is not included in recurring craft cost.`;
  if (plan.method === "flea")
    return "Buy from the flea market using a minimum estimate, catalog estimate, or manual buy price.";
  if (plan.method === "trader" && plan.traderOffer) {
    const offer = plan.traderOffer;
    const trader = context.tradersById[offer.traderId];
    const nativePrice = `${offer.price.toLocaleString()} ${offer.currency}`;
    return `Buy from ${trader?.name ?? "unknown trader"} at LL${offer.minTraderLevel} · ${nativePrice} (${Math.round(offer.priceRUB).toLocaleString()} ₽)${offer.taskUnlockId ? " · quest unlock required" : ""}${offer.buyLimit != null ? ` · limit ${offer.buyLimit}` : ""}.`;
  }
  if (plan.method === "barter" && plan.sourceId) {
    const barter = context.bartersById[plan.sourceId];
    const trader = barter ? context.tradersById[barter.traderId] : undefined;
    if (barter)
      return `Barter with ${trader?.name ?? "unknown trader"} at LL${barter.minTraderLevel} · ${plan.batches} batch${plan.batches === 1 ? "" : "es"}${barter.buyLimit ? ` · limit ${barter.buyLimit}` : ""}.`;
  }
  if (plan.method === "craft" && plan.sourceId) {
    const craft = context.craftsById[plan.sourceId];
    const station = craft ? context.stationsById[craft.stationId] : undefined;
    if (craft) {
      const allocatedCraftTime =
        craft.duration * (plan.quantity / craft.productCount);
      return `Craft at ${station?.name ?? "unknown station"} level ${craft.level} · ${plan.batches} batch${plan.batches === 1 ? "" : "es"} · ${formatDuration(allocatedCraftTime)} allocated craft time.`;
    }
  }
  return "No complete priced acquisition route is currently available.";
}

export function describeChainRoute(
  plan: AcquisitionPlan,
  context: RouteContext,
) {
  if (plan.method === "flea") return "Flea market";
  if (plan.method === "trader" && plan.traderOffer) {
    return `Trader LL${plan.traderOffer.minTraderLevel}`;
  }
  if (plan.method === "unavailable") return "No priced route";
  if (plan.method === "barter" && plan.sourceId) {
    const barter = context.bartersById[plan.sourceId];
    return `Barter LL${barter?.minTraderLevel ?? "?"}${plan.batches > 1 ? ` · ${plan.batches} batches` : ""}`;
  }
  if (plan.method === "craft" && plan.sourceId) {
    const craft = context.craftsById[plan.sourceId];
    return `Craft level ${craft?.level ?? "?"}${plan.batches > 1 ? ` · ${plan.batches} batches` : ""}`;
  }
  return "Acquisition route";
}
