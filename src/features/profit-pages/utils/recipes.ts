import type {
  AcquisitionPlan,
  RecipeEvaluation,
} from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { RecipePreviewData, RouteContext, SortMode } from "../types";
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
  sortMode: SortMode,
  itemsById: Readonly<Record<string, ItemSummary>>,
) {
  if (sortMode === "name") {
    return (
      itemsById[left.outputItemId]?.name ?? left.outputItemId
    ).localeCompare(itemsById[right.outputItemId]?.name ?? right.outputItemId);
  }
  const leftValue =
    sortMode === "cost"
      ? left.cost
      : sortMode === "profitPerHour"
        ? left.profitPerHour
        : left.profit;
  const rightValue =
    sortMode === "cost"
      ? right.cost
      : sortMode === "profitPerHour"
        ? right.profitPerHour
        : right.profit;
  if (sortMode === "cost")
    return (
      (leftValue ?? Number.POSITIVE_INFINITY) -
      (rightValue ?? Number.POSITIVE_INFINITY)
    );
  return (
    (rightValue ?? Number.NEGATIVE_INFINITY) -
    (leftValue ?? Number.NEGATIVE_INFINITY)
  );
}

export function hasRecipeRoute(plan: AcquisitionPlan): boolean {
  return (
    plan.method === "barter" ||
    plan.method === "craft" ||
    plan.children.some(hasRecipeRoute)
  );
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
    return "Buy from the flea market using the 24-hour average price.";
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
