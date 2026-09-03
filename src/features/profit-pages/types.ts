import type { ManualPriceOverride } from "@/lib/price-calculation";
import type {
  BarterRecord,
  CraftRecord,
  GlobalItem,
  Station,
  Trader,
} from "@/types";

export type ProfitPageKind = "barter" | "craft";
export type SortMode = "profit" | "profitPerHour" | "cost" | "name";
export type RouteMethod = "flea" | "barter" | "craft" | "unavailable";

export interface RouteContext {
  itemById: Readonly<Record<string, GlobalItem>>;
  bartersById: Readonly<Record<string, BarterRecord>>;
  craftsById: Readonly<Record<string, CraftRecord>>;
  tradersById: Readonly<Record<string, Trader>>;
  stationsById: Readonly<Record<string, Station>>;
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
