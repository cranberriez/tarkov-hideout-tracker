import { createRecipeCalculator } from "../../../lib/price-calculation/optimizer";
import type { AcquisitionPlan, RecipeCalculatorInput, RecipeEvaluation } from "../../../lib/price-calculation/types";
import { acquisitionRouteKey, getAcquisitionRoutes, withRequiredItemRoute } from "../utils/recipes";

export type BoardRanking = "profit-hour" | "profit" | "easy" | "duration";
export type BoardVariant = "direct" | "barter" | "craft";
export interface BoardChoice {
	variant: BoardVariant;
	routes?: Record<string, string>;
	unitCosts?: Record<string, number>;
}
export type BoardChoices = Record<string, BoardChoice>;
export interface BoardCraft {
	id: string;
	stationId: string;
	variants: Partial<Record<BoardVariant, RecipeEvaluation>>;
}
export const boardVariants: { id: BoardVariant; label: string }[] = [
	{ id: "direct", label: "Buy inputs" },
	{ id: "barter", label: "Include barters" },
	{ id: "craft", label: "Craft inputs" },
];
export const requirementKey = (plan: AcquisitionPlan) => `${plan.itemId}:${plan.isTool ? "tool" : "input"}`;
export function parseBoardChoices(raw: string | null): BoardChoices {
	try {
		const value = JSON.parse(raw ?? "{}");
		if (!value || typeof value !== "object" || Array.isArray(value)) return {};
		return Object.fromEntries(
			Object.entries(value).flatMap(([id, entry]) => {
				if (!entry || typeof entry !== "object") return [];
				const choice = entry as BoardChoice;
				if (!boardVariants.some((variant) => variant.id === choice.variant)) return [];
				const routes =
					choice.routes && typeof choice.routes === "object"
						? Object.fromEntries(Object.entries(choice.routes).filter(([, route]) => typeof route === "string"))
						: {};
				const unitCosts =
					choice.unitCosts && typeof choice.unitCosts === "object"
						? Object.fromEntries(Object.entries(choice.unitCosts).filter(([, price]) => typeof price === "number" && Number.isFinite(price) && price >= 0))
						: {};
				return [[id, { variant: choice.variant, routes, unitCosts }]];
			}),
		);
	} catch {
		return {};
	}
}
export function buildStationBoard(input: RecipeCalculatorInput): BoardCraft[] {
	const crafts = new Map<string, BoardCraft>();
	for (const variant of boardVariants) {
		const calculator = createRecipeCalculator({
			...input,
			maxDepth: 6,
			allowTraderPurchases: true,
			allowBarters: variant.id !== "direct",
			allowCrafts: variant.id === "craft",
		});
		for (const row of calculator.evaluateCrafts()) {
			if (!row.craft) continue;
			const group: BoardCraft = crafts.get(row.id) ?? { id: row.id, stationId: row.craft.stationId, variants: {} };
			group.variants[variant.id] = row;
			crafts.set(row.id, group);
		}
	}
	return [...crafts.values()];
}
export function selectedBoardCraft(craft: BoardCraft, choice?: BoardChoice): RecipeEvaluation {
	let row = craft.variants[choice?.variant ?? "direct"] ?? craft.variants.direct!;
	let missingRoute = false;
	for (const [index, part] of row.requiredItems.entries()) {
		const route = choice?.routes?.[requirementKey(part)];
		if (!route) continue;
		if (getAcquisitionRoutes(part).some((candidate) => acquisitionRouteKey(candidate) === route)) row = withRequiredItemRoute(row, index, route);
		else missingRoute = true;
	}
	if (choice?.unitCosts && Object.keys(choice.unitCosts).length) {
		const requiredItems = row.requiredItems.map((part) => {
			const price = choice.unitCosts?.[requirementKey(part)];
			return part.isTool || price === undefined ? part : { ...part, totalCost: price * part.quantity };
		});
		const unknown = requiredItems.some((part) => !part.isTool && part.totalCost === null);
		const cost = unknown ? null : requiredItems.reduce((total, part) => total + (part.isTool ? 0 : (part.totalCost ?? 0)), 0);
		const profit = cost === null || row.sellValue === null ? null : row.sellValue - cost;
		row = { ...row, requiredItems, cost, profit, profitPerHour: profit === null || row.durationSeconds <= 0 ? null : (profit * 3600) / row.durationSeconds };
	}
	// A stale saved route stays visible but cannot imply a silently substituted profit.
	return missingRoute
		? {
				...row,
				cost: null,
				profit: null,
				profitPerHour: null,
				lockReasons: [...row.lockReasons, { kind: "unavailable", message: "A saved input route is unavailable. Choose another route." }],
			}
		: row;
}
export function boardCraftAvailable(row: RecipeEvaluation): boolean {
	const usable = (part: AcquisitionPlan): boolean =>
		part.isTool === true ||
		(part.method !== "unavailable" && part.method !== "sell" && !part.lockReasons?.length && part.totalCost !== null && part.children.every(usable));
	return row.lockReasons.length === 0 && row.profit !== null && row.requiredItems.every(usable);
}
export function boardEffort(row: RecipeEvaluation): number {
	const purchases = new Set<string>();
	let handoffs = 0;
	function visit(part: AcquisitionPlan) {
		if (part.isTool) return;
		if (part.method === "craft" || part.method === "barter") handoffs += part.batches;
		else purchases.add(`${part.itemId}:${part.sourceId ?? part.method}`);
		part.children.forEach(visit);
	}
	row.requiredItems.forEach(visit);
	return purchases.size + handoffs * 3;
}
export function rankBoardCrafts(rows: RecipeEvaluation[], ranking: BoardRanking) {
	const score = (row: RecipeEvaluation) =>
		ranking === "easy"
			? -boardEffort(row)
			: ranking === "duration"
				? row.durationSeconds
				: ranking === "profit"
					? (row.profit ?? -Infinity)
					: (row.profitPerHour ?? -Infinity);
	return [...rows].sort((a, b) => score(b) - score(a) || (b.profit ?? -Infinity) - (a.profit ?? -Infinity) || a.id.localeCompare(b.id));
}
/** One batch of each saved craft; same-source purchases pool, tools remain separate. */
export function boardMaterials(rows: RecipeEvaluation[]) {
	const result = new Map<string, AcquisitionPlan>();
	function add(part: AcquisitionPlan) {
		if (!part.isTool && part.children.length) {
			part.children.forEach(add);
			return;
		}
		const key = `${requirementKey(part)}:${part.sourceId ?? part.method}`;
		const previous = result.get(key);
		result.set(key, {
			...part,
			quantity: part.isTool ? Math.max(previous?.quantity ?? 0, part.quantity) : (previous?.quantity ?? 0) + part.quantity,
			totalCost: part.isTool ? null : previous?.totalCost === null || part.totalCost === null ? null : (previous?.totalCost ?? 0) + part.totalCost,
		});
	}
	rows.forEach((row) => row.requiredItems.forEach(add));
	return [...result.values()];
}
