"use client";

import { ShoppingCart } from "lucide-react";
import type { ItemAmount, ItemTraderOffer } from "@/features/items/item-detail/item-detail-types";
import type { ItemSummary } from "@/types/items";
import { QuestLink } from "@/components/entities/quest-link";
import { AvailabilityBadge, RecommendationBadge, ToolBadge } from "./ItemDetailBadges";
import { ItemDetailItemChip } from "./ItemDetailItemChip";
import { ItemDetailRecipeFlow } from "./ItemDetailRecipeFlow";
import { ItemDetailRecipeProfit } from "./ItemDetailRecipeProfit";
import type { AcquisitionPlan, ManualPriceOverrides, RecipeEvaluation } from "@/lib/price-calculation";
import { formatCompactRoubles } from "@/lib/utils/market-price";
import { itemImageUrl } from "@/lib/utils/item-images";

interface ItemDetailAcquisitionProps {
	offers: ItemTraderOffer[];
	profileReady: boolean;
	completedQuests: Record<string, boolean>;
	traderLoyaltyLevels: Record<string, number>;
	evaluationsById: Readonly<Record<string, RecipeEvaluation>>;
	overrides?: ManualPriceOverrides;
	profitLoading: boolean;
	profitError: string | null;
	onRetryProfit?: () => void;
	outputItem: ItemSummary;
	/** Rows consume the viewed item (`outputItem`): link-only profit and the viewed item highlighted. */
	usedIn?: boolean;
}

export function ItemDetailAcquisition({
	offers,
	profileReady,
	completedQuests,
	traderLoyaltyLevels,
	evaluationsById,
	overrides = {},
	profitLoading,
	profitError,
	onRetryProfit,
	outputItem,
	usedIn = false,
}: ItemDetailAcquisitionProps) {
	// Availability ordering depends on the profile; keep data order until it loads.
	const sorted = !profileReady
		? [...offers].sort((a, b) => a.minTraderLevel - b.minTraderLevel)
		: [...offers].sort((a, b) => {
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
									<img src={offer.trader.imageLink} alt="" className="h-7 w-7 rounded-full object-cover" />
								) : (
									<span className="flex h-7 w-7 items-center justify-center rounded-full bg-highlight/5">
										<ShoppingCart size={14} />
									</span>
								)}
								<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
									<span className="text-sm font-medium text-foreground">{offer.trader.name}</span>
									<span className="text-[11px] text-muted-foreground">
										LL{offer.minTraderLevel}
										{offer.kind === "buy" && offer.buyLimit ? ` · Limit ${offer.buyLimit}` : ""}
									</span>
									{!usedIn && (
										<span className="rounded bg-highlight/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
											{offer.kind === "buy" ? "Buy" : "Barter"}
										</span>
									)}
									{profileReady && <AvailabilityBadge available={available} />}
									{profileReady && !available && (
										<LockedReasons
											offer={offer}
											loyaltyMet={loyaltyMet}
											questMet={questMet}
											currentLoyalty={currentLoyalty}
										/>
									)}
								</div>
							</div>
							{offer.kind === "buy" ? (
								<DirectPurchaseSummary offer={offer} outputItem={outputItem} />
							) : (
								<ItemDetailRecipeProfit
									evaluation={evaluation}
									recipeId={offer.id}
									kind="barter"
									outputItem={offer.outputItem ?? outputItem}
									loading={profitLoading}
									error={profitError}
									onRetry={onRetryProfit}
									linkOnly={usedIn}
								/>
							)}
						</div>

						{offer.kind === "barter" && (
							<ItemDetailRecipeFlow
								outputItem={offer.outputItem ?? outputItem}
								outputIsViewedItem={!offer.outputItem}
								outputCount={offer.offeredCount}
								outputSecondary={
									offer.buyLimit ? (
										<span className="text-[11px] font-medium text-muted-foreground">
											Limit <span className="font-mono font-semibold text-foreground/80">{offer.buyLimit}</span>
										</span>
									) : undefined
								}
							>
								{offer.requiredItems.map((entry) => (
									<CostItem
										key={entry.item.id}
										entry={entry}
										highlighted={usedIn && entry.item.id === outputItem.id}
										manualBuy={overrides[entry.item.id]?.buy}
										plan={evaluation?.requiredItems.find((candidate) => candidate.itemId === entry.item.id)}
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
	highlighted,
	manualBuy,
	plan,
}: {
	entry: ItemAmount;
	highlighted: boolean;
	manualBuy?: number;
	plan?: AcquisitionPlan;
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
			highlighted={highlighted}
			preferShortName
			flat
			quantityLabel={currencySymbol ? `${currencySymbol}${entry.count.toLocaleString()}` : `${entry.count}`}
			quantityOverlay={!currencySymbol}
			secondary={
				entry.isTool ? (
					<ToolBadge />
				) : plan ? (
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

function DirectPurchaseSummary({
	offer,
	outputItem,
}: {
	offer: Extract<ItemTraderOffer, { kind: "buy" }>;
	outputItem: ItemSummary;
}) {
	const outputImageLink = itemImageUrl(outputItem);
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
				{outputImageLink && <img src={outputImageLink} alt="" className="h-10 w-10 object-contain" />}
			</span>
		</div>
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
					<QuestLink
						questId={offer.taskUnlock.id}
						name={offer.taskUnlock.name}
						className="underline decoration-warning/30 underline-offset-2 hover:text-foreground"
					/>
				</span>
			)}
		</span>
	);
}
