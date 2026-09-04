"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import {
  getItemBuyPrice,
  type AcquisitionPlan,
  type ManualPriceOverride,
} from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type {
  GoToRecipeHandler,
  PriceChangeHandler,
  RecipePreviewData,
  RouteContext,
  RouteMethod,
} from "../types";
import {
  formatCompactPrice,
  formatDuration,
  formatQuantity,
  formatRoundedRoubles,
} from "../utils/formatters";
import {
  acquisitionRouteKey,
  describeRoute,
  getPlanRecipePreview,
  selectAcquisitionRoute,
} from "../utils/recipes";
import { InfoHint } from "./InfoHint";
import { InlineItemPrice } from "./InlineItemPrice";
import {
  RecipeItemHoverCard,
  type ItemHoverPosition,
} from "./RecipeItemHoverCard";
import { RouteIcon } from "./RouteIcon";
import { RouteSelector } from "./RouteSelector";

export function RecipeItem({
  item,
  count,
  method,
  totalPrice,
  priceKind,
  emphasized,
  plan,
  overrides,
  onPriceChange,
  routeContext,
  detail,
  showRouteIcon = true,
  fillColumn = false,
  compactLine = false,
  onItemOpen,
  onGoToRecipe,
  recipePreview,
  onRouteChange,
}: {
  item?: ItemSummary;
  count: number;
  method: RouteMethod;
  totalPrice: number | null;
  priceKind: "buy" | "sell";
  emphasized?: boolean;
  plan?: AcquisitionPlan;
  overrides: Record<string, ManualPriceOverride>;
  onPriceChange: PriceChangeHandler;
  routeContext: RouteContext;
  detail?: string;
  showRouteIcon?: boolean;
  fillColumn?: boolean;
  compactLine?: boolean;
  onItemOpen: (itemId: string) => void;
  onGoToRecipe?: GoToRecipeHandler;
  recipePreview?: RecipePreviewData;
  onRouteChange?: (routeKey: string) => void;
}) {
  const [hoverPosition, setHoverPosition] = useState<ItemHoverPosition | null>(
    null,
  );
  const routeDetail =
    detail ?? (plan ? describeRoute(plan, routeContext) : null);
  const unitRoutePrice =
    totalPrice === null || count <= 0 ? null : totalPrice / count;
  const directUnitPrice = item ? getItemBuyPrice(item, overrides) : null;
  const cheapestDirectTotal = plan?.directBuyCost ??
    (directUnitPrice === null ? null : directUnitPrice * count);
  const resolvedRecipePreview =
    recipePreview ?? getPlanRecipePreview(plan, routeContext);
  const theoreticalAlternative = plan?.alternatives.find(
    (alternative) =>
      alternative.method === plan.theoreticalMethod &&
      alternative.theoreticalCost === plan.theoreticalCost,
  );
  const theoreticalPlan =
    plan && theoreticalAlternative
      ? selectAcquisitionRoute(
          plan,
          acquisitionRouteKey(theoreticalAlternative),
        )
      : undefined;
  const theoreticalRecipePreview = getPlanRecipePreview(
    theoreticalPlan,
    routeContext,
  );
  const canGoToRecipe = Boolean(
    compactLine &&
      onGoToRecipe &&
      plan?.sourceId &&
      (plan.method === "barter" || plan.method === "craft"),
  );
  const routeSavingsTotal =
    plan &&
    (method === "barter" || method === "craft") &&
    cheapestDirectTotal !== null &&
    unitRoutePrice !== null
      ? cheapestDirectTotal - unitRoutePrice * count
      : null;
  function updateHoverPosition(event: React.MouseEvent<HTMLSpanElement>) {
    if ((event.target as HTMLElement).closest("[data-isolated-hover='true']")) {
      setHoverPosition(null);
      return;
    }
    const gap = 12;
    const hoverWidth = Math.min(
      resolvedRecipePreview || theoreticalRecipePreview ? 660 : 320,
      window.innerWidth - 16,
    );
    const preferredLeft =
      event.clientX + gap + hoverWidth <= window.innerWidth - 8
        ? event.clientX + gap
        : event.clientX - hoverWidth - gap;
    const placeAbove = event.clientY > window.innerHeight / 2;
    setHoverPosition({
      left: Math.max(
        8,
        Math.min(preferredLeft, window.innerWidth - hoverWidth - 8),
      ),
      placeAbove,
      verticalOffset: placeAbove
        ? window.innerHeight - event.clientY + gap
        : event.clientY + gap,
    });
  }
  const openItem = (event: React.MouseEvent) => {
    event.stopPropagation();
    setHoverPosition(null);
    if (item) onItemOpen(item.id);
  };
  return (
    <span
      className={`group/item relative flex shrink-0 items-center px-1 ${compactLine ? "h-9 w-full gap-1.5 hover:bg-white/[0.025]" : `h-full min-h-[72px] gap-1.5 ${fillColumn ? "w-full" : "w-40"} ${emphasized ? "bg-tarkov-green/[0.07]" : "bg-black/10"}`}`}
      onMouseEnter={updateHoverPosition}
      onMouseMove={updateHoverPosition}
      onMouseLeave={() => setHoverPosition(null)}
    >
      {compactLine ? (
        <>
          {showRouteIcon &&
          plan &&
          onRouteChange &&
          plan.alternatives.length > 0 ? (
            <RouteSelector
              plan={plan}
              item={item}
              routeContext={routeContext}
              onSelect={onRouteChange}
            />
          ) : (
            showRouteIcon && <RouteIcon method={method} inline />
          )}
          <button
            type="button"
            aria-label={`Open ${item?.name ?? "item"} details`}
            disabled={!item}
            onClick={openItem}
            className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center bg-white/[0.025] transition hover:bg-white/10 disabled:cursor-default"
          >
            {item?.iconLink ? (
              <Image
                src={item.iconLink}
                alt=""
                width={32}
                height={32}
                className="size-8 object-contain"
                unoptimized
              />
            ) : (
              <span className="size-8" />
            )}
          </button>
          <span
            className="min-w-0 truncate text-[11px] font-medium text-foreground"
            title={item?.name}
          >
            {item?.name ?? "Unknown item"}
          </span>
          {plan?.isTool && (
            <span className="shrink-0 rounded-[3px] bg-sky-400 px-1 py-0.5 text-[7px] font-black uppercase text-black">
              tool
            </span>
          )}
          <span className="shrink-0 text-[10px] text-muted-foreground">—</span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {formatQuantity(count)} ×
          </span>
          <span className="shrink-0 font-mono text-[10px]">
            {plan?.isTool ? (
              <span className="text-sky-200">cost excluded</span>
            ) : (
              <InlineItemPrice
                item={item}
                kind={priceKind}
                totalPrice={totalPrice}
                displayPrice={unitRoutePrice}
                overrides={overrides}
                onPriceChange={onPriceChange}
                editable={method === "flea"}
              />
            )}
          </span>
          {(routeSavingsTotal ?? 0) > 0 ||
          (plan?.durationSeconds ?? 0) > 0 ||
          canGoToRecipe ? (
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              {(routeSavingsTotal ?? 0) > 0 &&
                cheapestDirectTotal !== null &&
                plan?.totalCost !== null && (
                  <span className="flex items-center gap-0.5 whitespace-nowrap text-[9px] text-amber-300">
                    {method === "craft" ? "Craft" : "Barter"} saves{" "}
                    {formatCompactPrice(routeSavingsTotal)}
                    <InfoHint
                      title={`${method === "craft" ? "Crafting" : "Bartering"} saves ${formatRoundedRoubles(routeSavingsTotal)}`}
                      onShow={() => setHoverPosition(null)}
                    >
                      <span className="block">
                        {method === "craft" ? "Crafting" : "Bartering for"}{" "}
                        {formatQuantity(count)} × {item?.name ?? "this item"}{" "}
                        costs{" "}
                        <strong className="text-white">
                          {formatRoundedRoubles(plan?.totalCost ?? null)}
                        </strong>
                        .
                      </span>
                      <span className="mt-1 block">
                        The cheapest eligible direct purchase for the same quantity costs{" "}
                        <strong className="text-white">
                          {formatRoundedRoubles(cheapestDirectTotal)}
                        </strong>
                        .
                      </span>
                    </InfoHint>
                  </span>
                )}
              {(plan?.durationSeconds ?? 0) > 0 && (
                <span className="font-mono text-[9px] text-orange-300">
                  {formatDuration(plan?.durationSeconds ?? 0)}
                </span>
              )}
              {canGoToRecipe &&
                plan?.sourceId &&
                (plan.method === "barter" || plan.method === "craft") && (
                  <button
                    type="button"
                    title={`Go to ${plan.method} recipe`}
                    aria-label={`Go to ${plan.method} recipe for ${item?.name ?? "item"}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setHoverPosition(null);
                      onGoToRecipe?.(
                        plan.method as "barter" | "craft",
                        plan.sourceId as string,
                      );
                    }}
                    className="flex size-6 shrink-0 items-center justify-center rounded border border-white/10 bg-black/70 text-muted-foreground opacity-0 transition hover:border-tarkov-green/50 hover:text-tarkov-green group-hover/item:opacity-100 focus:opacity-100"
                  >
                    <ExternalLink className="size-3.5" />
                  </button>
                )}
            </span>
          ) : null}
        </>
      ) : (
        <>
          <button
            type="button"
            aria-label={`Open ${item?.name ?? "item"} details`}
            disabled={!item}
            onClick={openItem}
            className="relative flex size-12 shrink-0 cursor-pointer items-center justify-center bg-white/[0.025] transition hover:bg-white/10 disabled:cursor-default"
          >
            {showRouteIcon && <RouteIcon method={method} />}
            {plan?.isTool && (
              <span className="absolute -right-0.5 -top-0.5 z-10 rounded-[3px] bg-sky-400 px-1 py-0.5 text-[7px] font-black uppercase text-black shadow">
                tool
              </span>
            )}
            {item?.iconLink ? (
              <Image
                src={item.iconLink}
                alt=""
                width={48}
                height={48}
                className="size-12 object-contain"
                unoptimized
              />
            ) : (
              <span className="size-12" />
            )}
          </button>
          <span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
            <span
              className="w-full truncate text-[11px] font-medium leading-tight text-foreground"
              title={item?.name}
            >
              {item?.shortName ?? item?.name ?? "Unknown item"}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              Quantity ×{formatQuantity(count)}
            </span>
            <span className="font-mono text-[10px]">
              {plan?.isTool ? (
                <span className="text-sky-200">Cost excluded</span>
              ) : (
                <InlineItemPrice
                  item={item}
                  kind={priceKind}
                  totalPrice={totalPrice}
                  overrides={overrides}
                  onPriceChange={onPriceChange}
                  editable={priceKind === "sell" || method === "flea"}
                />
              )}
            </span>
          </span>
        </>
      )}
      {hoverPosition &&
        createPortal(
          <RecipeItemHoverCard
            position={hoverPosition}
            item={item}
            count={count}
            method={method}
            totalPrice={totalPrice}
            priceKind={priceKind}
            plan={plan}
            overrides={overrides}
            routeContext={routeContext}
            routeDetail={routeDetail}
            recipePreview={resolvedRecipePreview}
            theoreticalRecipePreview={theoreticalRecipePreview}
            theoreticalSavings={
              plan?.totalCost != null && plan.theoreticalCost != null
                ? plan.totalCost - plan.theoreticalCost
                : null
            }
            showRouteIcon={showRouteIcon}
          />,
          document.body,
        )}
    </span>
  );
}
