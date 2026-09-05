import type { ManualPriceOverride } from "@/lib/price-calculation";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { ItemSummary } from "@/types/items";
import type { Station } from "@/types/hideout";
import type { Trader } from "@/types/traders";

export type ProfitPageKind = "barter" | "craft";
export type SortKey = "cost" | "sellValue" | "profit" | "profitPerHour";
export type SortDirection = "ascending" | "descending";
export type RouteMethod = "flea" | "trader" | "barter" | "craft" | "unavailable";
export type ProfitStationSource = Pick<
  Station,
  "id" | "name" | "normalizedName" | "imageLink"
>;

export interface RouteContext {
  itemById: Readonly<Record<string, ItemSummary>>;
  bartersById: Readonly<Record<string, BarterRecord>>;
  craftsById: Readonly<Record<string, CraftRecord>>;
  tradersById: Readonly<Record<string, Trader>>;
  stationsById: Readonly<Record<string, ProfitStationSource>>;
}

export interface RecipePreviewData {
  kind: "barter" | "craft";
  sourceId: string;
  outputItemId: string;
  outputCount: number;
  batches: number;
  requiredItems: import("@/lib/price-calculation").AcquisitionPlan[];
  durationSeconds: number;
}

export type PriceChangeHandler = (
  itemId: string,
  override: ManualPriceOverride,
) => void;
export type GoToRecipeHandler = (
  method: "barter" | "craft",
  recipeId: string,
) => void;
