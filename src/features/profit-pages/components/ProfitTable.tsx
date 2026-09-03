"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
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
  ProfitPageKind,
} from "../types";
import {
  estimateProfitRowHeight,
  isRecipeAvailable,
  profitGrid,
} from "../utils/recipes";
import { ProfitRow } from "./ProfitRow";

export function ProfitTable({
  kind,
  evaluations,
  itemById,
  tradersById,
  stationsById,
  bartersById,
  craftsById,
  stationLevels,
  traderLoyaltyLevels,
  completedQuests,
  overrides,
  onPriceChange,
  onItemOpen,
  onGoToRecipe,
  targetRecipeId,
  scrollRequestId,
  pinnedCrafts,
  onTogglePinnedCraft,
  showPinnedOnly,
}: {
  kind: ProfitPageKind;
  evaluations: RecipeEvaluation[];
  itemById: Readonly<Record<string, GlobalItem>>;
  tradersById: Readonly<Record<string, Trader>>;
  stationsById: Readonly<Record<string, Station>>;
  bartersById: Readonly<Record<string, BarterRecord>>;
  craftsById: Readonly<Record<string, CraftRecord>>;
  stationLevels: Record<string, number>;
  traderLoyaltyLevels: Record<string, number>;
  completedQuests: Record<string, boolean>;
  overrides: Record<string, ManualPriceOverride>;
  onPriceChange: PriceChangeHandler;
  onItemOpen: (itemId: string) => void;
  onGoToRecipe: GoToRecipeHandler;
  targetRecipeId: string | null;
  scrollRequestId: number;
  pinnedCrafts: Record<string, boolean>;
  onTogglePinnedCraft: (recipeId: string) => void;
  showPinnedOnly: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
    const lastScrollRequestRef = useRef<string | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const updateScrollMargin = () => {
      if (listRef.current)
        setScrollMargin(
          listRef.current.getBoundingClientRect().top + window.scrollY,
        );
    };
    updateScrollMargin();
    window.addEventListener("resize", updateScrollMargin);
    return () => window.removeEventListener("resize", updateScrollMargin);
  }, [kind]);
  const virtualizer = useWindowVirtualizer({
    count: evaluations.length,
    estimateSize: (index) => estimateProfitRowHeight(evaluations[index]),
    getItemKey: (index) => evaluations[index]?.id ?? index,
    overscan: 8,
    scrollMargin,
  });
    useEffect(() => {
        const requestKey = targetRecipeId
            ? `${targetRecipeId}:${scrollRequestId}`
            : null;
        if (!requestKey || scrollMargin <= 0 || lastScrollRequestRef.current === requestKey)
            return;
    const targetIndex = evaluations.findIndex(
      (evaluation) => evaluation.id === targetRecipeId,
    );
    if (targetIndex < 0) return;
    virtualizer.scrollToIndex(targetIndex, { align: "center" });
        lastScrollRequestRef.current = requestKey;
  }, [evaluations, scrollMargin, scrollRequestId, targetRecipeId, virtualizer]);
  return (
    <div className="overflow-x-auto rounded-md border border-white/10 bg-card/50">
      <div
        className={`grid w-full min-w-[1000px] border-b border-white/10 bg-black/30 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${profitGrid()}`}
      >
        <span aria-label="Actions" />
        <span className="pl-3">Source</span>
        <span className="pl-3">Output</span>
        <span className="pl-3">Required items</span>
        <span className="px-3">Cost</span>
        <span className="px-3">Sell value</span>
        <span className="px-3">Profit</span>
        <span className="px-3">Profit / hour</span>
      </div>
      <div ref={listRef} className="w-full min-w-[1000px]">
        {evaluations.length > 0 ? (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const evaluation = evaluations[virtualRow.index];
              const translateY =
                virtualRow.start - virtualizer.options.scrollMargin;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full border-b border-white/10"
                  style={{ transform: `translateY(${translateY}px)` }}
                >
                  <ProfitRow
                    evaluation={evaluation}
                    itemById={itemById}
                    sourceName={
                      kind === "barter"
                        ? tradersById[evaluation.barter?.traderId ?? ""]?.name
                        : stationsById[evaluation.craft?.stationId ?? ""]?.name
                    }
                    available={isRecipeAvailable(
                      evaluation,
                      stationLevels,
                      traderLoyaltyLevels,
                      completedQuests,
                    )}
                    source={
                      kind === "barter"
                        ? tradersById[evaluation.barter?.traderId ?? ""]
                        : stationsById[evaluation.craft?.stationId ?? ""]
                    }
                    overrides={overrides}
                    onPriceChange={onPriceChange}
                    bartersById={bartersById}
                    craftsById={craftsById}
                    tradersById={tradersById}
                    stationsById={stationsById}
                    onItemOpen={onItemOpen}
                    onGoToRecipe={onGoToRecipe}
                    highlighted={evaluation.id === targetRecipeId}
                    pinned={
                      kind === "craft" && Boolean(pinnedCrafts[evaluation.id])
                    }
                    onTogglePinned={
                      kind === "craft"
                        ? () => onTogglePinnedCraft(evaluation.id)
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-14 text-center text-sm text-muted-foreground">
            {kind === "craft" && showPinnedOnly
              ? Object.keys(pinnedCrafts).length === 0
                ? "No pinned crafts yet. Pin a craft from the actions column to add it here."
                : "No pinned crafts match these filters."
              : "No recipes match these filters."}
          </div>
        )}
      </div>
    </div>
  );
}
