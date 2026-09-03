import Image from "next/image";
import {
  getItemBuyPrice,
  getItemSellComparison,
  getItemSellPrice,
  type AcquisitionPlan,
  type ManualPriceOverride,
} from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { RecipePreviewData, RouteContext, RouteMethod } from "../types";
import {
  formatDuration,
  formatQuantity,
  formatRoundedRoubles,
  formatSignedRoubles,
  formatTraderOffer,
} from "../utils/formatters";
import { RecipePreviewCard } from "./RecipePreviewCard";
import { RouteIcon, routeChipClasses } from "./RouteIcon";

export interface ItemHoverPosition {
  left: number;
  placeAbove: boolean;
  verticalOffset: number;
}

export function RecipeItemHoverCard({
  position,
  item,
  count,
  method,
  totalPrice,
  priceKind,
  plan,
  overrides,
  routeContext,
  routeDetail,
  recipePreview,
  showRouteIcon,
}: {
  position: ItemHoverPosition;
  item?: ItemSummary;
  count: number;
  method: RouteMethod;
  totalPrice: number | null;
  priceKind: "buy" | "sell";
  plan?: AcquisitionPlan;
  overrides: Record<string, ManualPriceOverride>;
  routeContext: RouteContext;
  routeDetail: string | null;
  recipePreview?: RecipePreviewData;
  showRouteIcon: boolean;
}) {
  const unitRoutePrice =
    totalPrice === null || count <= 0 ? null : totalPrice / count;
  const directUnitPrice = item
    ? priceKind === "buy"
      ? getItemBuyPrice(item, overrides)
      : getItemSellPrice(item, overrides)
    : null;
  const hasOverride = Boolean(
    item && overrides[item.id]?.[priceKind] !== undefined,
  );
  const sellComparison =
    priceKind === "sell" ? getItemSellComparison(item, overrides) : null;
  const routeLabel = plan?.isTool
    ? "Reusable tool"
    : method === "flea"
      ? "Flea market"
      : method === "barter"
        ? "Barter"
        : method === "craft"
          ? "Craft"
          : "Unavailable";
  const routeSavingsPerUnit =
    plan &&
    method !== "flea" &&
    directUnitPrice !== null &&
    unitRoutePrice !== null
      ? directUnitPrice - unitRoutePrice
      : null;
  const ingredientSellValue =
    plan && !plan.isTool && item
      ? (() => {
          const price = getItemSellPrice(item, overrides);
          return price === null ? null : price * count;
        })()
      : null;
  const ingredientSellPremium =
    ingredientSellValue !== null &&
    plan?.totalCost !== null &&
    plan?.totalCost !== undefined
      ? ingredientSellValue - plan.totalCost
      : null;
  return (
    <span
      className="pointer-events-none fixed z-[100] flex max-w-[calc(100vw-16px)] items-stretch gap-2 text-left"
      style={{
        left: position.left,
        width: recipePreview ? Math.min(660, window.innerWidth - 16) : 320,
        ...(position.placeAbove
          ? { bottom: position.verticalOffset }
          : { top: position.verticalOffset }),
      }}
    >
      <span className="block w-80 max-w-full shrink-0 rounded-md border border-white/15 bg-[#05070a] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.8)]">
        <span className="flex items-center gap-3">
          <span className="relative flex size-16 shrink-0 items-center justify-center bg-white/[0.035]">
            {showRouteIcon && <RouteIcon method={method} />}
            {item?.iconLink && (
              <Image
                src={item.iconLink}
                alt=""
                width={64}
                height={64}
                className="size-16 object-contain"
                unoptimized
              />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-white">
              {item?.name ?? "Unknown item"}
            </span>
            <span
              className={`mt-1 inline-flex rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${routeChipClasses(method)}`}
            >
              {routeLabel}
            </span>
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              ×{formatQuantity(count)}
            </span>
          </span>
        </span>
        {routeDetail && (
          <span className="mt-3 block border-t border-white/10 pt-2 text-[11px] leading-relaxed text-foreground/80">
            {routeDetail}
          </span>
        )}
        <span className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded bg-white/[0.035] p-2 font-mono text-[10px]">
          {priceKind === "sell" && sellComparison ? (
            <>
              {
                <>
                  <span className="text-muted-foreground">
                    Flea sale / unit
                  </span>
                  <span className="text-foreground">
                    {formatRoundedRoubles(sellComparison.fleaPrice)}
                  </span>
                  <span className="text-muted-foreground">
                    Best trader / unit
                  </span>
                  <span className="text-right text-foreground">
                    {sellComparison.bestTraderOffer ? (
                      <>
                        {sellComparison.bestTraderOffer.vendor.name} ·{" "}
                        {formatTraderOffer(
                          sellComparison.bestTraderOffer,
                          1,
                          true,
                        )}
                      </>
                    ) : (
                      "-"
                    )}
                  </span>
                  {sellComparison.manualPrice !== null && (
                    <>
                      <span className="text-muted-foreground">
                        Manual sale / unit
                      </span>
                      <span className="text-amber-300">
                        {formatRoundedRoubles(sellComparison.manualPrice)}
                      </span>
                    </>
                  )}
                </>
              }
            </>
          ) : (
            <>
              <span className="text-muted-foreground">
                Flea purchase / unit
              </span>
              <span
                className={hasOverride ? "text-amber-300" : "text-foreground"}
              >
                {formatRoundedRoubles(directUnitPrice)}
                {hasOverride ? " · manual" : ""}
              </span>
            </>
          )}
          {plan && (
            <>
              <span className="text-muted-foreground">
                {method === "flea"
                  ? "Selected route / unit"
                  : `${routeLabel} / unit`}
              </span>
              <span className="text-sky-200">
                {formatRoundedRoubles(unitRoutePrice)}
              </span>
            </>
          )}
          {routeSavingsPerUnit !== null && (
            <>
              <span className="text-muted-foreground">Savings / unit</span>
              <span
                className={
                  routeSavingsPerUnit > 0 ? "text-tarkov-green" : "text-red-300"
                }
              >
                {formatSignedRoubles(routeSavingsPerUnit)}
              </span>
            </>
          )}
          {plan && ingredientSellValue !== null && (
            <>
              <span className="text-muted-foreground">
                Best sale value / total
              </span>
              <span className="text-amber-200">
                {formatRoundedRoubles(ingredientSellValue)}
              </span>
            </>
          )}
          {plan &&
            ingredientSellPremium !== null &&
            ingredientSellPremium > 0 && (
              <>
                <span className="text-muted-foreground">
                  Sale value above route cost
                </span>
                <span className="text-amber-300">
                  +{formatRoundedRoubles(ingredientSellPremium)}
                </span>
              </>
            )}
          <span className="text-muted-foreground">Quantity</span>
          <span className="text-foreground">× {formatQuantity(count)}</span>
          <span className="border-t border-white/10 pt-1 text-muted-foreground">
            Total
          </span>
          <span className="border-t border-white/10 pt-1 font-semibold text-tarkov-green">
            {plan?.isTool ? "Excluded" : formatRoundedRoubles(totalPrice)}
          </span>
        </span>
        {plan && (plan.batches > 1 || plan.durationSeconds > 0) && (
          <span className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
            <span>
              Batches{" "}
              <b className="font-mono text-foreground">{plan.batches}</b>
            </span>
            {plan.durationSeconds > 0 && (
              <span>
                Route time{" "}
                <b className="font-mono text-orange-300">
                  {formatDuration(plan.durationSeconds)}
                </b>
              </span>
            )}
          </span>
        )}
        {plan?.isTool && (
          <span className="mt-2 block text-[10px] text-sky-200">
            Reusable tool price is not included in the craft cost.
          </span>
        )}
        {plan?.theoreticalMethod !== undefined &&
          plan.theoreticalMethod !== method && (
            <span className="mt-2 block text-[10px] text-violet-300">
              Cheapest theoretical route: {plan.theoreticalMethod} ·{" "}
              {formatRoundedRoubles(plan.theoreticalCost)}
            </span>
          )}
      </span>
      {recipePreview && (
        <RecipePreviewCard
          preview={recipePreview}
          routeContext={routeContext}
        />
      )}
    </span>
  );
}
