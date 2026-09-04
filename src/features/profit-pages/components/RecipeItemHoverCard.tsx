import Image from "next/image";
import { X } from "lucide-react";
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

export interface RecipeItemHoverData {
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
  theoreticalRecipePreview?: RecipePreviewData;
  theoreticalSavings?: number | null;
  showRouteIcon: boolean;
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
  theoreticalRecipePreview,
  theoreticalSavings,
  showRouteIcon,
  onClose,
  onKeepOpen,
}: RecipeItemHoverData & {
  onClose: () => void;
  onKeepOpen: () => void;
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
  const selectedDirectHasOverride = hasOverride && plan?.directBuyMethod !== "trader";
  const sellComparison =
    priceKind === "sell" ? getItemSellComparison(item, overrides) : null;
  const routeLabel = plan?.isTool
    ? "Reusable tool"
    : method === "flea"
      ? "Flea market"
      : method === "trader"
        ? "Trader"
      : method === "barter"
        ? "Barter"
        : method === "craft"
          ? "Craft"
          : "Unavailable";
  const directRouteUnitPrice =
    plan?.directBuyCost != null && count > 0
      ? plan.directBuyCost / count
      : directUnitPrice;
  const routeSavingsPerUnit =
    plan &&
    method !== "flea" &&
    method !== "trader" &&
    directRouteUnitPrice !== null &&
    unitRoutePrice !== null
      ? directRouteUnitPrice - unitRoutePrice
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
        width:
          recipePreview || theoreticalRecipePreview
            ? Math.min(660, window.innerWidth - 16)
            : 320,
        ...(position.placeAbove
          ? { bottom: position.verticalOffset }
          : { top: position.verticalOffset }),
      }}
    >
      <span className="relative block w-80 max-w-full shrink-0 rounded-md border border-white/15 bg-[#05070a] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.8)]">
        <button
          type="button"
          aria-label="Close item details"
          title="Close"
          onMouseEnter={onKeepOpen}
          onMouseLeave={onClose}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
          className="pointer-events-auto absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded text-white/25 transition hover:bg-white/[0.06] hover:text-white/65 focus:outline-none focus:ring-1 focus:ring-white/30"
        >
          <X className="size-3" />
        </button>
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
                {plan?.directBuyMethod === "trader"
                  ? "Cheapest direct (trader) / unit"
                  : "Flea/manual purchase / unit"}
              </span>
              <span
                className={selectedDirectHasOverride ? "text-amber-300" : "text-foreground"}
              >
                {formatRoundedRoubles(directRouteUnitPrice)}
                {selectedDirectHasOverride ? " · manual" : ""}
              </span>
            </>
          )}
          {plan?.method === "trader" && plan.traderOffer && (
            <>
              <span className="text-muted-foreground">Native trader price</span>
              <span className="text-purple-200">
                {plan.traderOffer.price.toLocaleString()} {plan.traderOffer.currency}
              </span>
              <span className="text-muted-foreground">Trader / loyalty</span>
              <span className="text-right text-foreground">
                {routeContext.tradersById[plan.traderOffer.traderId]?.name ?? "Unknown trader"} · LL{plan.traderOffer.minTraderLevel}
              </span>
              {plan.traderOffer.taskUnlockId && (
                <>
                  <span className="text-muted-foreground">Quest unlock</span>
                  <span className="text-right text-amber-200">Required</span>
                </>
              )}
              {plan.traderOffer.buyLimit != null && (
                <>
                  <span className="text-muted-foreground">Buy limit</span>
                  <span className="text-right text-foreground">{plan.traderOffer.buyLimit}</span>
                </>
              )}
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
      {recipePreview &&
        (!theoreticalRecipePreview ||
          theoreticalRecipePreview.sourceId === recipePreview.sourceId) && (
        <RecipePreviewCard
          preview={recipePreview}
          routeContext={routeContext}
        />
      )}
      {theoreticalRecipePreview &&
        (!recipePreview ||
          theoreticalRecipePreview.sourceId !== recipePreview.sourceId) && (
          <span className="relative block min-w-0 flex-1 pt-4">
            <span className="absolute left-2 top-0 z-10 rounded-full border border-violet-300/30 bg-violet-400 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-black shadow-lg">
              Alternate route · ~{formatRoundedRoubles(theoreticalSavings ?? null)} cheaper
            </span>
            <RecipePreviewCard
              preview={theoreticalRecipePreview}
              routeContext={routeContext}
            />
          </span>
        )}
    </span>
  );
}
