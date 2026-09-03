"use client";

import Link from "next/link";
import { Check, LockKeyhole, ShoppingCart } from "lucide-react";
import type { ItemAmount, ItemTraderOffer } from "@/features/items/item-detail/item-detail-types";
import type { ItemSummary } from "@/types/items";
import { getQuestDeepLinkHref } from "@/features/quests/quest-deep-link";
import { ItemDetailItemChip } from "./ItemDetailItemChip";
import { ItemDetailRecipeFlow } from "./ItemDetailRecipeFlow";
import { ItemDetailRecipeProfit } from "./ItemDetailRecipeProfit";
import type { AcquisitionPlan, RecipeEvaluation } from "@/lib/price-calculation";

interface ItemDetailAcquisitionProps {
    offers: ItemTraderOffer[];
    completedQuests: Record<string, boolean>;
    traderLoyaltyLevels: Record<string, number>;
    evaluationsById: Readonly<Record<string, RecipeEvaluation>>;
    profitLoading: boolean;
    profitError: string | null;
    outputItem: ItemSummary;
    onItemClick: (itemId: string) => void;
}

export function ItemDetailAcquisition({
    offers,
    completedQuests,
    traderLoyaltyLevels,
    evaluationsById,
    profitLoading,
    profitError,
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
                const isCurrencyPurchase =
                    offer.requiredItems.length > 0 &&
                    offer.requiredItems.every((entry) =>
                        ["roubles", "dollars", "euros"].includes(entry.item.normalizedName),
                    );

                return (
                    <div key={offer.id} className="bg-black/10 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <div className="flex min-w-48 flex-1 items-center gap-2.5">
                                {offer.trader.imageLink ? (
                                    <img
                                        src={offer.trader.imageLink}
                                        alt=""
                                        className="h-8 w-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
                                        <ShoppingCart size={14} />
                                    </span>
                                )}
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium text-foreground">
                                            {offer.trader.name}
                                        </span>
                                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                            {isCurrencyPurchase ? "Purchase" : "Barter"}
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
                            <ItemDetailRecipeProfit
                                evaluation={evaluation}
                                recipeId={offer.id}
                                kind="barter"
                                loading={profitLoading}
                                error={profitError}
                            />
                        </div>

                        <ItemDetailRecipeFlow
                            outputItem={outputItem}
                            outputCount={offer.offeredCount}
                        >
                            {offer.requiredItems.map((entry) => (
                                <CostItem
                                    key={entry.item.id}
                                    entry={entry}
                                    plan={evaluation?.requiredItems.find(
                                        (candidate) => candidate.itemId === entry.item.id,
                                    )}
                                    onItemClick={onItemClick}
                                />
                            ))}
                        </ItemDetailRecipeFlow>
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
    plan,
    onItemClick,
}: {
    entry: ItemAmount;
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
                entry.isTool ? <ToolBadge /> : plan ? <RecommendationBadge plan={plan} /> : undefined
            }
        />
    );
}

function ToolBadge() {
    return (
        <span className="shrink-0 rounded bg-sky-400/10 px-1 py-0.5 text-[9px] font-bold uppercase text-sky-200">
            Tool
        </span>
    );
}

function RecommendationBadge({ plan }: { plan: AcquisitionPlan }) {
    const label =
        plan.method === "flea"
            ? "Buy"
            : plan.method === "craft"
              ? "Craft"
              : plan.method === "barter"
                ? "Barter"
                : "Unpriced";
    const classes =
        plan.method === "craft"
            ? "bg-orange-400/10 text-orange-200"
            : plan.method === "barter"
              ? "bg-sky-400/10 text-sky-200"
              : plan.method === "flea"
                ? "bg-tarkov-green/10 text-tarkov-green"
                : "bg-white/5 text-muted-foreground";
    return (
        <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${classes}`}>
            {label}
        </span>
    );
}

function AvailabilityBadge({ available }: { available: boolean }) {
    return (
        <span
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                available
                    ? "bg-tarkov-green/10 text-tarkov-green"
                    : "bg-amber-400/10 text-amber-200"
            }`}
        >
            {available ? <Check size={10} /> : <LockKeyhole size={10} />}
            {available ? "Available" : "Locked"}
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
        <span className="flex flex-wrap items-center gap-x-1 text-[10px] text-amber-200">
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
                        className="underline decoration-amber-200/30 underline-offset-2 hover:text-foreground"
                    >
                        {offer.taskUnlock.name}
                    </Link>
                </span>
            )}
        </span>
    );
}
