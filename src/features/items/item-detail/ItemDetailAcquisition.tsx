"use client";

import Link from "next/link";
import { Check, LockKeyhole, ShoppingCart } from "lucide-react";
import type { ItemAmount, ItemTraderOffer } from "@/features/items/item-detail/item-detail-types";
import type { ItemSummary } from "@/types/items";
import { getQuestDeepLinkHref } from "@/features/quests/quest-deep-link";
import { ItemDetailItemChip } from "./ItemDetailItemChip";
import { ItemDetailRecipeFlow } from "./ItemDetailRecipeFlow";
import { ItemDetailRecipeProfit } from "./ItemDetailRecipeProfit";
import type { AcquisitionPlan, ManualPriceOverrides, RecipeEvaluation } from "@/lib/price-calculation";
import { formatCompactRoubles } from "@/lib/utils/market-price";

interface ItemDetailAcquisitionProps {
    offers: ItemTraderOffer[];
    completedQuests: Record<string, boolean>;
    traderLoyaltyLevels: Record<string, number>;
    evaluationsById: Readonly<Record<string, RecipeEvaluation>>;
    overrides?: ManualPriceOverrides;
    profitLoading: boolean;
    profitError: string | null;
    onRetryProfit?: () => void;
    outputItem: ItemSummary;
    onItemClick: (itemId: string) => void;
}

export function ItemDetailAcquisition({
    offers,
    completedQuests,
    traderLoyaltyLevels,
    evaluationsById,
    overrides = {},
    profitLoading,
    profitError,
    onRetryProfit,
    outputItem,
    onItemClick,
}: ItemDetailAcquisitionProps) {
    const sorted = [...offers].sort((a, b) => {
        const aAvailable = isOfferAvailable(a, completedQuests, traderLoyaltyLevels);
        const bAvailable = isOfferAvailable(b, completedQuests, traderLoyaltyLevels);
        return Number(bAvailable) - Number(aAvailable) || a.minTraderLevel - b.minTraderLevel;
    });

    return (
        <div className="divide-y divide-border-color">
            {sorted.map((offer) => {
                const evaluation = evaluationsById[offer.id];
                const currentLoyalty = traderLoyaltyLevels[offer.trader.id] ?? 1;
                const loyaltyMet = currentLoyalty >= offer.minTraderLevel;
                const questMet = !offer.taskUnlock || completedQuests[offer.taskUnlock.id] === true;
                const available = loyaltyMet && questMet;
                return (
                    <div key={offer.id} className="bg-shadow/10 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="flex min-w-48 flex-1 items-center gap-2.5">
                                {offer.trader.imageLink ? (
                                    <img
                                        src={offer.trader.imageLink}
                                        alt=""
                                        className="h-8 w-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-highlight/5">
                                        <ShoppingCart size={14} />
                                    </span>
                                )}
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium text-foreground">
                                            {offer.trader.name}
                                        </span>
                                        <span className="rounded bg-highlight/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                            {offer.kind === "buy" ? "Buy" : "Barter"}
                                        </span>
                                        <AvailabilityBadge available={available} />
                                        {!available && (
                                            <LockedReasons
                                                offer={offer}
                                                loyaltyMet={loyaltyMet}
                                                questMet={questMet}
                                                currentLoyalty={currentLoyalty}
                                            />
                                        )}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                                        LL{offer.minTraderLevel}
                                        {offer.buyLimit ? ` · Limit ${offer.buyLimit}` : ""}
                                    </div>
                                </div>
                            </div>
                            {offer.kind === "buy" ? (
                                <DirectPurchaseSummary offer={offer} outputItem={outputItem} />
                            ) : (
                                <ItemDetailRecipeProfit
                                    evaluation={evaluation}
                                    recipeId={offer.id}
                                    kind="barter"
                                    loading={profitLoading}
                                    error={profitError}
                                    onRetry={onRetryProfit}
                                />
                            )}
                        </div>

                        {offer.kind === "barter" && (
                            <ItemDetailRecipeFlow
                                outputItem={outputItem}
                                outputCount={offer.offeredCount}
                            >
                                {offer.requiredItems.map((entry) => (
                                    <CostItem
                                        key={entry.item.id}
                                        entry={entry}
                                        manualBuy={overrides[entry.item.id]?.buy}
                                        plan={evaluation?.requiredItems.find(
                                            (candidate) => candidate.itemId === entry.item.id,
                                        )}
                                        onItemClick={onItemClick}
                                    />
                                ))}
                            </ItemDetailRecipeFlow>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function isOfferAvailable(
    offer: ItemTraderOffer,
    completedQuests: Record<string, boolean>,
    loyalty: Record<string, number>,
) {
    return (
        (loyalty[offer.trader.id] ?? 1) >= offer.minTraderLevel &&
        (!offer.taskUnlock || completedQuests[offer.taskUnlock.id] === true)
    );
}

function CostItem({
    entry,
    manualBuy,
    plan,
    onItemClick,
}: {
    entry: ItemAmount;
    manualBuy?: number;
    plan?: AcquisitionPlan;
    onItemClick: (itemId: string) => void;
}) {
    const currencySymbol =
        entry.item.normalizedName === "roubles"
            ? "₽"
            : entry.item.normalizedName === "dollars"
              ? "$"
              : entry.item.normalizedName === "euros"
                ? "€"
                : null;
    return (
        <ItemDetailItemChip
            item={entry.item}
            onClick={() => onItemClick(entry.item.id)}
            quantityLabel={
                currencySymbol
                    ? `${currencySymbol}${entry.count.toLocaleString()}`
                    : `${entry.count}`
            }
            quantityOverlay={!currencySymbol}
            secondary={
                entry.isTool ? <ToolBadge /> : plan ? (
                    <RecommendationBadge
                        plan={plan}
                        unstable={
                            entry.item.marketPrice?.fleaStability === "unstable" &&
                            entry.item.normalizedName !== "roubles" &&
                            !(typeof manualBuy === "number" && Number.isFinite(manualBuy) && manualBuy >= 0)
                        }
                    />
                ) : undefined
            }
        />
    );
}

function ToolBadge() {
    return (
        <span className="shrink-0 rounded bg-info/10 px-1 py-0.5 text-[9px] font-bold uppercase text-info">
            Tool
        </span>
    );
}

function RecommendationBadge({ plan, unstable }: { plan: AcquisitionPlan; unstable: boolean }) {
    const label =
        plan.method === "flea"
            ? "Buy"
            : plan.method === "sell"
              ? "Found"
            : plan.method === "trader"
              ? "Trader"
            : plan.method === "craft"
              ? "Craft"
              : plan.method === "barter"
                ? "Barter"
                : "Unpriced";
    const classes =
        plan.method === "craft"
            ? "bg-acquisition-craft/10 text-acquisition-craft"
            : plan.method === "trader"
              ? "bg-acquisition-trader/10 text-acquisition-trader"
            : plan.method === "barter"
              ? "bg-acquisition-barter/10 text-acquisition-barter"
            : plan.method === "flea"
                ? "bg-acquisition-flea/10 text-acquisition-flea"
                : plan.method === "sell"
                  ? "bg-acquisition-sell-value/10 text-acquisition-sell-value"
                : "bg-highlight/5 text-muted-foreground";
    return (
        <span className="flex flex-wrap items-center gap-1.5">
            <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${classes}`}>
                {label}
            </span>
            {unstable && plan.method === "flea" && plan.totalCost !== null && (
                <span className="text-[10px] font-normal text-warning">(value unstable)</span>
            )}
            {plan.method === "sell" && plan.totalCost !== null && (
                <span className="text-[10px] font-normal text-muted-foreground">(sell value)</span>
            )}
            {plan.totalCost !== null && (
                <span className="flex shrink-0 items-baseline gap-1 leading-none">
                    <span className="font-mono text-[10px] font-semibold text-foreground/80">
                        {formatCompactRoubles(Math.round(plan.totalCost))} ₽
                    </span>
                    <span className="text-[7px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Total
                    </span>
                </span>
            )}
        </span>
    );
}

function DirectPurchaseSummary({
    offer,
    outputItem,
}: {
    offer: Extract<ItemTraderOffer, { kind: "buy" }>;
    outputItem: ItemSummary;
}) {
    const outputImageLink = outputItem.iconLink ?? outputItem.gridImageLink;
    const currency = offer.currency.toLowerCase();
    const currencySymbol =
        currency === "roubles" || currency === "rub"
            ? "₽"
            : currency === "dollars" || currency === "usd"
              ? "$"
              : currency === "euros" || currency === "eur"
                ? "€"
                : offer.currency;
    return (
        <div className="ml-auto flex items-center gap-5">
            <span className="font-mono text-base text-foreground">
                {currencySymbol === "₽"
                    ? `${formatCompactRoubles(offer.price)} ₽`
                    : `${currencySymbol}${offer.price.toLocaleString()}`}
            </span>
            <span className="flex items-center gap-2">
                <span className="font-mono text-base font-semibold text-foreground">1 ×</span>
                {outputImageLink && (
                    <img src={outputImageLink} alt="" className="h-10 w-10 object-contain" />
                )}
            </span>
        </div>
    );
}

function AvailabilityBadge({ available }: { available: boolean }) {
    return (
        <span
            className={available ? "text-success" : "text-danger"}
            title={available ? "Available" : "Locked"}
            aria-label={available ? "Available" : "Locked"}
        >
            {available ? <Check size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}
        </span>
    );
}

function LockedReasons({
    offer,
    loyaltyMet,
    questMet,
    currentLoyalty,
}: {
    offer: ItemTraderOffer;
    loyaltyMet: boolean;
    questMet: boolean;
    currentLoyalty: number;
}) {
    return (
        <span className="flex flex-wrap items-center gap-x-1 text-[10px] text-warning">
            {!loyaltyMet && (
                <span>
                    Needs LL{offer.minTraderLevel} (current LL{currentLoyalty})
                </span>
            )}
            {!loyaltyMet && !questMet && <span className="text-muted-foreground">·</span>}
            {!questMet && offer.taskUnlock && (
                <span>
                    Needs{" "}
                    <Link
                        href={getQuestDeepLinkHref(offer.taskUnlock.id)}
                        className="underline decoration-warning/30 underline-offset-2 hover:text-foreground"
                    >
                        {offer.taskUnlock.name}
                    </Link>
                </span>
            )}
        </span>
    );
}
