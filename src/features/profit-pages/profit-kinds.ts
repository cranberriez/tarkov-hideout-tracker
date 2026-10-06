import type { createRecipeCalculator, RecipeEvaluation } from "@/lib/price-calculation";
import type { ProfitPageKind, SortKey } from "./types";

type RecipeCalculator = ReturnType<typeof createRecipeCalculator>;

export interface ProfitKindDefinition {
	/** Singular label, e.g. "Barter" in "Barter profit data is unavailable". */
	label: string;
	title: string;
	drawerStorageKey: string;
	defaultSortKey: SortKey;
	supportsPinning: boolean;
	evaluate: (calculator: RecipeCalculator) => RecipeEvaluation[];
}

/** Per-kind copy and behavior for the profit pages. */
export const PROFIT_KINDS: Readonly<Record<ProfitPageKind, ProfitKindDefinition>> = {
	barter: {
		label: "Barter",
		title: "BARTER PROFITS",
		drawerStorageKey: "tarkov-filter-drawer-v1:barter-profits",
		defaultSortKey: "profit",
		supportsPinning: false,
		evaluate: (calculator) => calculator.evaluateBarters(),
	},
	craft: {
		label: "Craft",
		title: "CRAFTING PROFITS",
		drawerStorageKey: "tarkov-filter-drawer-v1:crafting-profits",
		defaultSortKey: "profitPerHour",
		supportsPinning: true,
		evaluate: (calculator) => calculator.evaluateCrafts(),
	},
};
