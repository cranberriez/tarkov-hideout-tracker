"use client";

import { useState } from "react";
import { ChevronRight, Pin } from "lucide-react";
import type {
  ManualPriceOverride,
  RecipeEvaluation,
} from "@/lib/price-calculation";
import type {
  BarterRecord,
  CraftRecord,
  GlobalItem,
  Station,
  Trader,
} from "@/types";
import type {
  GoToRecipeHandler,
  PriceChangeHandler,
  RouteContext,
} from "../types";
import {
  formatDuration,
  formatRoundedRoubles,
  formatSignedRoubles,
} from "../utils/formatters";
import { hasRecipeRoute, profitGrid } from "../utils/recipes";
import { ProfitCell, SellValueCell } from "./ProfitCells";
import { ProfitSourceCell } from "./ProfitSourceCell";
import { RecipeChain } from "./RecipeChain";
import { RecipeItem } from "./RecipeItem";

export function ProfitRow({
  evaluation,
  itemById,
  sourceName,
  available,
  source,
  overrides,
  onPriceChange,
  bartersById,
  craftsById,
  tradersById,
  stationsById,
  onItemOpen,
  onGoToRecipe,
  highlighted,
  pinned,
  onTogglePinned,
}: {
  evaluation: RecipeEvaluation;
  itemById: Readonly<Record<string, GlobalItem>>;
  sourceName?: string;
  available: boolean;
  source?: Trader | Station;
  overrides: Record<string, ManualPriceOverride>;
  onPriceChange: PriceChangeHandler;
  bartersById: Readonly<Record<string, BarterRecord>>;
  craftsById: Readonly<Record<string, CraftRecord>>;
  tradersById: Readonly<Record<string, Trader>>;
  stationsById: Readonly<Record<string, Station>>;
  onItemOpen: (itemId: string) => void;
  onGoToRecipe: GoToRecipeHandler;
  highlighted: boolean;
  pinned: boolean;
  onTogglePinned?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const output = itemById[evaluation.outputItemId];
  const routeContext: RouteContext = {
    itemById,
    bartersById,
    craftsById,
    tradersById,
    stationsById,
  };
  const hasNestedRecipe = evaluation.requiredItems.some(hasRecipeRoute);
  return (
    <div
      className={
        highlighted
          ? "bg-tarkov-green/[0.06] ring-1 ring-inset ring-tarkov-green/40"
          : undefined
      }
    >
      <div className={`grid min-h-[72px] items-stretch ${profitGrid()}`}>
        <div className="flex flex-col items-center justify-center gap-1 border-r border-white/5 bg-black/10">
          {onTogglePinned && (
            <button
              type="button"
              aria-pressed={pinned}
              aria-label={pinned ? "Unpin craft" : "Pin craft"}
              title={pinned ? "Unpin craft" : "Pin craft"}
              onClick={onTogglePinned}
              className={`flex size-7 items-center justify-center rounded border transition ${pinned ? "border-sky-400/40 bg-sky-400/10 text-sky-300" : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-sky-400/40 hover:text-sky-300"}`}
            >
              <Pin className={`size-4 ${pinned ? "fill-current" : ""}`} />
            </button>
          )}
          {hasNestedRecipe && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`${expanded ? "Collapse" : "Expand"} recipe chain`}
              title={`${expanded ? "Collapse" : "Expand"} recipe chain`}
              onClick={() => setExpanded((value) => !value)}
              className="flex size-7 items-center justify-center rounded border border-white/10 bg-white/[0.035] text-muted-foreground transition hover:border-tarkov-green/50 hover:text-tarkov-green"
            >
              <ChevronRight
                className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
          )}
        </div>
        <ProfitSourceCell
          evaluation={evaluation}
          source={source}
          available={available}
        />
        <div className="min-w-0 border-r border-white/5">
          <RecipeItem
            item={output}
            count={evaluation.outputCount}
            method={evaluation.kind}
            totalPrice={evaluation.sellValue}
            priceKind="sell"
            emphasized
            fillColumn
            showRouteIcon={false}
            overrides={overrides}
            onPriceChange={onPriceChange}
            routeContext={routeContext}
            onItemOpen={onItemOpen}
            recipePreview={{
              kind: evaluation.kind,
              sourceId: evaluation.id,
              outputItemId: evaluation.outputItemId,
              outputCount: evaluation.outputCount,
              batches: 1,
              requiredItems: evaluation.requiredItems,
              durationSeconds: evaluation.craft?.duration ?? 0,
            }}
            detail={
              evaluation.barter
                ? `Barter with ${sourceName ?? "unknown trader"} at LL${evaluation.barter.minTraderLevel}`
                : `Craft at ${sourceName ?? "unknown station"} level ${evaluation.craft?.level ?? "?"} · ${formatDuration(evaluation.craft?.duration ?? 0)}`
            }
          />
        </div>
        <div className="flex min-w-0 flex-col justify-center py-0.5">
          {evaluation.requiredItems.map((plan) => (
            <RecipeItem
              key={`${plan.itemId}:${plan.isTool === true}`}
              item={itemById[plan.itemId]}
              count={plan.quantity}
              method={plan.method}
              totalPrice={plan.totalCost}
              plan={plan}
              priceKind="buy"
              overrides={overrides}
              onPriceChange={onPriceChange}
              routeContext={routeContext}
              compactLine
              onItemOpen={onItemOpen}
              onGoToRecipe={onGoToRecipe}
            />
          ))}
        </div>
        <ProfitCell label="Cost">
          {formatRoundedRoubles(evaluation.cost)}
        </ProfitCell>
        <SellValueCell
          item={output}
          count={evaluation.outputCount}
          sellValue={evaluation.sellValue}
          overrides={overrides}
        />
        <ProfitCell
          label="Profit"
          value={evaluation.profit}
          detail={`Total time ${evaluation.durationSeconds > 0 ? formatDuration(evaluation.durationSeconds) : "-"}`}
          infoTitle="Sell the ingredients instead"
          info={
            evaluation.profitVsSellingInputs !== null &&
            evaluation.profitVsSellingInputs < 0 &&
            evaluation.inputSellValue !== null &&
            evaluation.sellValue !== null ? (
              <>
                <span className="block">
                  Selling all non-tool ingredients individually would return{" "}
                  <strong className="text-white">
                    {formatRoundedRoubles(evaluation.inputSellValue)}
                  </strong>
                  .
                </span>
                <span className="mt-1 block">
                  The {evaluation.kind === "barter" ? "barter" : "craft"} output
                  sells for{" "}
                  <strong className="text-white">
                    {formatRoundedRoubles(evaluation.sellValue)}
                  </strong>
                  .
                </span>
                <span className="mt-2 block border-t border-white/10 pt-2 text-amber-200">
                  If you already own the ingredients, selling them separately is
                  worth{" "}
                  <strong>
                    {formatRoundedRoubles(-evaluation.profitVsSellingInputs)}
                  </strong>{" "}
                  more.
                </span>
              </>
            ) : undefined
          }
        >
          {formatSignedRoubles(evaluation.profit)}
        </ProfitCell>
        <ProfitCell label="Profit / hour" value={evaluation.profitPerHour}>
          {formatSignedRoubles(evaluation.profitPerHour)}
        </ProfitCell>
      </div>
      {expanded && hasNestedRecipe && (
        <RecipeChain
          evaluation={evaluation}
          routeContext={routeContext}
          onGoToRecipe={onGoToRecipe}
        />
      )}
    </div>
  );
}
