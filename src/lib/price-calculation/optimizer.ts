import type { BarterRecord, CraftRecord, ItemAmountRef } from "@/types/recipes";
import { getItemBuyPrice, getItemSellPrice, practicalSavingsThreshold } from "./prices";
import type {
    AcquisitionAlternative,
    AcquisitionPlan,
    PriceCalculationContext,
    RecipeCalculatorInput,
    RecipeEvaluation,
} from "./types";

interface Candidate {
    method: AcquisitionAlternative["method"];
    sourceId?: string;
    batches: number;
    totalCost: number;
    theoreticalCost: number;
    durationSeconds: number;
    children: AcquisitionPlan[];
}

function aggregateRequirements(requirements: ItemAmountRef[], multiplier: number) {
    const totals = new Map<string, ItemAmountRef>();
    for (const requirement of requirements) {
        const key = `${requirement.itemId}:${requirement.isTool === true ? "tool" : "item"}`;
        const current = totals.get(key);
        totals.set(key, {
            itemId: requirement.itemId,
            count: (current?.count ?? 0) + requirement.count * multiplier,
            ...(requirement.isTool ? { isTool: true } : {}),
        });
    }
    return [...totals.values()];
}

function sumPlanCost(plans: AcquisitionPlan[], field: "totalCost" | "theoreticalCost") {
    let total = 0;
    for (const plan of plans) {
        if (plan.isTool) continue;
        const value = plan[field];
        if (value === null) return null;
        total += value;
    }
    return total;
}

function sumRequirementSellValue(
    requirements: ItemAmountRef[],
    context: PriceCalculationContext,
) {
    let total = 0;
    for (const requirement of requirements) {
        if (requirement.isTool) continue;
        const unitSellValue = getItemSellPrice(
            context.itemsById[requirement.itemId],
            context.overrides,
        );
        if (unitSellValue === null) return null;
        total += unitSellValue * requirement.count;
    }
    return total;
}

export function createAcquisitionOptimizer(context: PriceCalculationContext) {
    const maxDepth = context.maxDepth ?? 16;
    const overrides = context.overrides ?? {};
    const memo = new Map<string, AcquisitionPlan>();

    function optimize(
        itemId: string,
        quantity = 1,
        blocked = new Set<string>(),
        depth = 0,
    ): AcquisitionPlan {
        const normalizedQuantity = Math.max(0, quantity);
        const memoKey = `${itemId}:${normalizedQuantity}:${[...blocked].sort().join(",")}`;
        const cached = memo.get(memoKey);
        if (cached) return cached;

        if (normalizedQuantity === 0) {
            return {
                itemId,
                quantity: 0,
                method: "flea",
                batches: 0,
                totalCost: 0,
                theoreticalCost: 0,
                theoreticalMethod: "flea",
                durationSeconds: 0,
                children: [],
                alternatives: [],
            };
        }

        if (depth >= maxDepth || blocked.has(itemId)) {
            return unavailablePlan(itemId, normalizedQuantity);
        }

        const nextBlocked = new Set(blocked).add(itemId);
        const candidates: Candidate[] = [];
        const unitBuyPrice = getItemBuyPrice(context.itemsById[itemId], overrides);
        if (unitBuyPrice !== null) {
            candidates.push({
                method: "flea",
                batches: 1,
                totalCost: unitBuyPrice * normalizedQuantity,
                theoreticalCost: unitBuyPrice * normalizedQuantity,
                durationSeconds: 0,
                children: [],
            });
        }

        if (context.allowBarters !== false) {
            for (const barter of context.bartersByItemId[itemId] ?? []) {
                const candidate = evaluateAcquisitionRecipe(
                    "barter",
                    barter,
                    normalizedQuantity,
                    nextBlocked,
                    depth,
                );
                if (candidate) candidates.push(candidate);
            }
        }
        if (context.allowCrafts !== false) {
            for (const craft of context.craftsByItemId[itemId] ?? []) {
                const candidate = evaluateAcquisitionRecipe(
                    "craft",
                    craft,
                    normalizedQuantity,
                    nextBlocked,
                    depth,
                );
                if (candidate) candidates.push(candidate);
            }
        }

        if (candidates.length === 0) return unavailablePlan(itemId, normalizedQuantity);

        const theoretical = [...candidates].sort(
            (left, right) => left.theoreticalCost - right.theoreticalCost,
        )[0];
        let recommended = [...candidates].sort((left, right) => left.totalCost - right.totalCost)[0];
        const flea = candidates.find((candidate) => candidate.method === "flea");
        if (flea && recommended.method !== "flea") {
            const savings = flea.totalCost - recommended.totalCost;
            if (savings <= practicalSavingsThreshold(flea.totalCost)) recommended = flea;
        }

        const plan: AcquisitionPlan = {
            itemId,
            quantity: normalizedQuantity,
            method: recommended.method,
            sourceId: recommended.sourceId,
            batches: recommended.batches,
            totalCost: recommended.totalCost,
            theoreticalCost: theoretical.theoreticalCost,
            theoreticalMethod: theoretical.method,
            durationSeconds: recommended.durationSeconds,
            children: recommended.children,
            alternatives: candidates
                .filter((candidate) => !isSameCandidate(candidate, recommended))
                .sort((left, right) => left.totalCost - right.totalCost)
                .map(toAcquisitionAlternative),
        };
        memo.set(memoKey, plan);
        return plan;
    }

    function evaluateAcquisitionRecipe(
        kind: "barter" | "craft",
        recipe: BarterRecord | CraftRecord,
        quantity: number,
        blocked: Set<string>,
        depth: number,
    ): Candidate | null {
        const outputCount = kind === "barter"
            ? (recipe as BarterRecord).offeredCount
            : (recipe as CraftRecord).productCount;
        if (!(outputCount > 0)) return null;
        // Passive/zero-input production has operational costs outside this
        // dataset and must not become a free recursive ingredient source.
        if (recipe.requiredItems.length === 0) return null;
        if (kind === "craft" && (recipe as CraftRecord).requiredQuestItems.length > 0) {
            return null;
        }
        const batches = Math.ceil(quantity / outputCount);
        const requirements = aggregateRequirements(recipe.requiredItems, batches);
        const children = requirements.map((requirement) => ({
            ...optimize(requirement.itemId, requirement.count, blocked, depth + 1),
            ...(requirement.isTool ? { isTool: true } : {}),
        }));
        const totalCost = sumPlanCost(children, "totalCost");
        const theoreticalCost = sumPlanCost(children, "theoreticalCost");
        if (totalCost === null || theoreticalCost === null) return null;
        return {
            method: kind,
            sourceId: recipe.id,
            batches,
            totalCost,
            theoreticalCost,
            durationSeconds:
                (kind === "craft"
                    ? (recipe as CraftRecord).duration * (quantity / outputCount)
                    : 0) +
                children.reduce(
                    (total, child) => total + (child.isTool ? 0 : child.durationSeconds),
                    0,
                ),
            children,
        };
    }

    return { optimize };
}

function isSameCandidate(left: Candidate, right: Candidate) {
    return left.method === right.method && left.sourceId === right.sourceId;
}

function toAcquisitionAlternative(candidate: Candidate): AcquisitionAlternative {
    return {
        method: candidate.method,
        sourceId: candidate.sourceId,
        batches: candidate.batches,
        totalCost: candidate.totalCost,
        theoreticalCost: candidate.theoreticalCost,
        durationSeconds: candidate.durationSeconds,
    };
}

function unavailablePlan(itemId: string, quantity: number): AcquisitionPlan {
    return {
        itemId,
        quantity,
        method: "unavailable",
        batches: 0,
        totalCost: null,
        theoreticalCost: null,
        theoreticalMethod: "unavailable",
        durationSeconds: 0,
        children: [],
        alternatives: [],
    };
}

function indexRecipesByOutput<T>(
    records: readonly T[],
    getItemId: (record: T) => string,
): Record<string, T[]> {
    const result: Record<string, T[]> = Object.create(null) as Record<string, T[]>;
    for (const record of records) (result[getItemId(record)] ??= []).push(record);
    return result;
}

/**
 * Creates one pricing calculator over an already-loaded acquisition graph.
 * The graph remains price-independent; this instance owns the current price
 * context and shares one recursive memoization cache across every evaluation.
 */
export function createRecipeCalculator(input: RecipeCalculatorInput) {
    const context: PriceCalculationContext = {
        itemsById: input.itemsById,
        bartersByItemId: indexRecipesByOutput(
            input.barters,
            (barter) => barter.offeredItemId,
        ),
        craftsByItemId: indexRecipesByOutput(
            input.crafts,
            (craft) => craft.productItemId,
        ),
        overrides: input.overrides,
        maxDepth: input.maxDepth,
        allowBarters: input.allowBarters,
        allowCrafts: input.allowCrafts,
    };
    const optimizer = createAcquisitionOptimizer(context);

    return {
        evaluateNode: optimizer.optimize,
        evaluateRecipe(
            kind: "barter" | "craft",
            recipe: BarterRecord | CraftRecord,
        ) {
            return evaluateTopLevelRecipe(kind, recipe, context, optimizer);
        },
        evaluateBarter(barter: BarterRecord) {
            return evaluateTopLevelRecipe("barter", barter, context, optimizer);
        },
        evaluateCraft(craft: CraftRecord) {
            return evaluateTopLevelRecipe("craft", craft, context, optimizer);
        },
        evaluateBarters(barters: readonly BarterRecord[] = input.barters) {
            return barters.map((barter) =>
                evaluateTopLevelRecipe("barter", barter, context, optimizer),
            );
        },
        evaluateCrafts(crafts: readonly CraftRecord[] = input.crafts) {
            return crafts.map((craft) =>
                evaluateTopLevelRecipe("craft", craft, context, optimizer),
            );
        },
    };
}

export function evaluateBarter(
    barter: BarterRecord,
    context: PriceCalculationContext,
): RecipeEvaluation {
    return evaluateTopLevelRecipe("barter", barter, context);
}

export function evaluateCraft(
    craft: CraftRecord,
    context: PriceCalculationContext,
): RecipeEvaluation {
    return evaluateTopLevelRecipe("craft", craft, context);
}

export function evaluateBarters(
    barters: BarterRecord[],
    context: PriceCalculationContext,
) {
    const optimizer = createAcquisitionOptimizer(context);
    return barters.map((barter) =>
        evaluateTopLevelRecipe("barter", barter, context, optimizer),
    );
}

export function evaluateCrafts(
    crafts: CraftRecord[],
    context: PriceCalculationContext,
) {
    const optimizer = createAcquisitionOptimizer(context);
    return crafts.map((craft) =>
        evaluateTopLevelRecipe("craft", craft, context, optimizer),
    );
}

function evaluateTopLevelRecipe(
    kind: "barter" | "craft",
    recipe: BarterRecord | CraftRecord,
    context: PriceCalculationContext,
    optimizer = createAcquisitionOptimizer(context),
): RecipeEvaluation {
    const outputItemId = kind === "barter"
        ? (recipe as BarterRecord).offeredItemId
        : (recipe as CraftRecord).productItemId;
    const outputCount = kind === "barter"
        ? (recipe as BarterRecord).offeredCount
        : (recipe as CraftRecord).productCount;
    const blocked = new Set([outputItemId]);
    const aggregatedRequirements = aggregateRequirements(recipe.requiredItems, 1);
    const requiredItems = aggregatedRequirements.map((requirement) => ({
        ...optimizer.optimize(requirement.itemId, requirement.count, blocked),
        ...(requirement.isTool ? { isTool: true } : {}),
    }));
    const hasUnpricedRequirements =
        recipe.requiredItems.length === 0 ||
        (kind === "craft" && (recipe as CraftRecord).requiredQuestItems.length > 0);
    const cost = hasUnpricedRequirements ? null : sumPlanCost(requiredItems, "totalCost");
    const theoreticalCost = hasUnpricedRequirements
        ? null
        : sumPlanCost(requiredItems, "theoreticalCost");
    const unitSellPrice = getItemSellPrice(
        context.itemsById[outputItemId],
        context.overrides,
    );
    const unitBuyPrice = getItemBuyPrice(
        context.itemsById[outputItemId],
        context.overrides,
    );
    const sellValue = unitSellPrice === null ? null : unitSellPrice * outputCount;
    const directBuyCost = unitBuyPrice === null ? null : unitBuyPrice * outputCount;
    const profit = cost === null || sellValue === null ? null : sellValue - cost;
    const inputSellValue = hasUnpricedRequirements
        ? null
        : sumRequirementSellValue(aggregatedRequirements, context);
    const profitVsSellingInputs = inputSellValue === null || sellValue === null
        ? null
        : sellValue - inputSellValue;
    const durationSeconds =
        (kind === "craft" ? (recipe as CraftRecord).duration : 0) +
        requiredItems.reduce(
            (total, plan) => total + (plan.isTool ? 0 : plan.durationSeconds),
            0,
        );
    const profitPerHour = profit === null || durationSeconds <= 0
        ? null
        : profit / (durationSeconds / 3_600);
    const savings = directBuyCost === null || cost === null ? null : directBuyCost - cost;
    const meaningfulSavings =
        savings === null || directBuyCost === null
            ? null
            : savings > practicalSavingsThreshold(directBuyCost);

    return {
        id: recipe.id,
        kind,
        outputItemId,
        outputCount,
        requiredItems,
        cost,
        theoreticalCost,
        sellValue,
        profit,
        inputSellValue,
        profitVsSellingInputs,
        durationSeconds,
        profitPerHour,
        directBuyCost,
        isPracticallyWorthwhile: meaningfulSavings,
        ...(kind === "barter"
            ? { barter: recipe as BarterRecord }
            : { craft: recipe as CraftRecord }),
    };
}
