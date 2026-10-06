import type { useProfitPricingContext } from "./ProfitPricingContext";
import Image from "next/image";
import { LockKeyhole, X } from "lucide-react";
import { QuestLink } from "@/components/entities/quest-link";
import { getItemSellComparison, type AcquisitionPlan, type ManualPriceOverride } from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { RecipePreviewData, RouteContext, RouteMethod } from "../types";
import { formatDuration, formatQuantity, formatRoundedRoubles, formatTraderOffer } from "../utils/formatters";
import { describeSelectedLock } from "../utils/lock-summary";
import { RecipePreviewCard } from "./RecipePreviewCard";
import { RouteGlyph, routeChipClasses } from "./RouteIcon";
import { itemImageUrl } from "@/lib/utils/item-images";
import { traderInfo } from "@/lib/data/traders";

export interface RecipeItemHoverData {
	pricingContext: ReturnType<typeof useProfitPricingContext>;
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
	recipeCost?: number | null;
}

const METHOD_LABELS: Record<RouteMethod, string> = {
	flea: "Flea market",
	trader: "Trader",
	barter: "Barter",
	craft: "Craft",
	sell: "Sell value",
	empty: "Empty value",
	unavailable: "No source",
};

/** Label/value rows: labels left, figures right-aligned so they scan down one edge. */
function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
	return (
		<span
			className={`flex items-baseline justify-between gap-4 border-t border-highlight/[0.07] py-1.5 first:border-t-0 ${strong ? "font-semibold" : ""}`}
		>
			<span className="text-muted-foreground">{label}</span>
			<span className="text-right font-mono text-foreground">{children}</span>
		</span>
	);
}

/** Where the selected route comes from, in a few words. */
function sourceSummary(plan: AcquisitionPlan | undefined, method: RouteMethod, context: RouteContext) {
	if (!plan) return null;
	if (method === "trader" && plan.traderOffer) {
		const offer = plan.traderOffer;
		const native = offer.currency !== "RUB" ? ` · ${offer.price.toLocaleString()} ${offer.currency}` : "";
		return `${context.tradersById[offer.traderId]?.name ?? "Unknown trader"} LL${offer.minTraderLevel}${native}`;
	}
	if (method === "barter" && plan.sourceId) {
		const barter = context.bartersById[plan.sourceId];
		return barter
			? `${context.tradersById[barter.traderId]?.name ?? "Unknown trader"} LL${barter.minTraderLevel}`
			: null;
	}
	if (method === "craft" && plan.sourceId) {
		const craft = context.craftsById[plan.sourceId];
		return craft ? `${context.stationsById[craft.stationId]?.name ?? "Unknown station"} ${craft.level}` : null;
	}
	if (method === "sell") return "Opportunity cost of not selling it";
	if (method === "empty") return "Saved empty-container value for this profile";
	return null;
}

export function RecipeItemHoverCard({
	pricingContext,
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
	recipeCost,
	onClose,
	onKeepOpen,
}: RecipeItemHoverData & {
	onClose: () => void;
	onKeepOpen: () => void;
}) {
	const unitRoutePrice = totalPrice === null || count <= 0 ? null : totalPrice / count;
	const manualPrice = Boolean(method !== "empty" && item && overrides[item.id]?.[priceKind] !== undefined);
	const sale = priceKind === "sell" ? getItemSellComparison(item, overrides, pricingContext, count) : null;
	const recipeSavings =
		plan && (method === "barter" || method === "craft") && plan.directBuyCost !== null && plan.totalCost !== null
			? plan.directBuyCost - plan.totalCost
			: null;
	const recipeShare =
		plan && !plan.isTool && plan.totalCost !== null && recipeCost != null && recipeCost > 0
			? plan.totalCost / recipeCost
			: null;
	const lockReasons = plan ? describeSelectedLock(plan, routeContext) : [];
	const summary = priceKind === "sell" ? routeDetail : sourceSummary(plan, method, routeContext);
	const questName = (questId: string) => pricingContext.taskUnlocksById?.[questId]?.name || "Quest details unavailable";
	return (
		<span className="pointer-events-auto relative flex min-w-0 flex-1 overflow-hidden rounded-md border border-highlight/15 bg-[var(--background)] text-xs shadow-[0_18px_55px_color-mix(in_oklab,_var(--shadow)_80%,_transparent)]">
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
				className="pointer-events-auto absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded text-foreground/25 transition hover:bg-highlight/[0.06] hover:text-foreground/65 focus:outline-none focus:ring-1 focus:ring-highlight/30"
			>
				<X className="size-3" />
			</button>
			<span className="relative block w-80 max-w-full shrink-0 p-3">
				<span className={`flex items-center gap-3 ${recipePreview ? "" : "pr-5"}`}>
					<span className="relative flex size-12 shrink-0 items-center justify-center bg-highlight/[0.035]">
						{item && (
							<Image
								src={itemImageUrl(item)}
								alt=""
								width={48}
								height={48}
								className="size-12 object-contain"
								unoptimized
							/>
						)}
					</span>
					<span className="min-w-0">
						<span className="block text-sm font-semibold leading-tight text-foreground">
							{item?.name ?? "Unknown item"}
						</span>
						<span className="mt-1 flex min-w-0 items-center gap-1.5">
							{priceKind === "buy" && (
								<span
									className={`flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${routeChipClasses(method)}`}
								>
									{showRouteIcon && <RouteGlyph method={method} />}
									{plan?.isTool ? "Tool" : METHOD_LABELS[method]}
								</span>
							)}
							{summary && <span className="truncate text-[11px] text-muted-foreground">{summary}</span>}
						</span>
					</span>
				</span>

				<span className="mt-3 block">
					{sale ? (
						<>
							<Row label={`Sale price${count > 1 ? " / unit" : ""}`}>
								<span className={manualPrice ? "text-info" : undefined}>
									{formatRoundedRoubles(sale.selectedPrice)}
								</span>
							</Row>
							{sale.fee !== null && sale.fee > 0 && (
								<Row label="Flea listing fee">−{formatRoundedRoubles(sale.fee)}</Row>
							)}
							{sale.bestTraderOffer && (
								<Row label={`Best trader (${traderInfo(sale.bestTraderOffer.traderId).name})`}>
									{formatTraderOffer(sale.bestTraderOffer, 1, true)}
								</Row>
							)}
							<Row label={`Net proceeds${count > 1 ? ` (×${formatQuantity(count)})` : ""}`} strong>
								<span className="text-brand">{formatRoundedRoubles(sale.netTotal)}</span>
							</Row>
						</>
					) : (
						<>
							<Row label="Price / unit">
								<span className={manualPrice ? "text-info" : undefined}>
									{formatRoundedRoubles(unitRoutePrice)}
									{manualPrice ? " (custom)" : ""}
								</span>
							</Row>
							<Row label={`Total (×${formatQuantity(count)})`} strong>
								<span className="text-brand">{formatRoundedRoubles(totalPrice)}</span>
							</Row>
							{recipeShare !== null && (
								<Row label="Share of recipe cost">
									{recipeShare < 0.01 ? "<1%" : `${Math.round(recipeShare * 100)}%`}
								</Row>
							)}
							{recipeSavings !== null && recipeSavings > 0 && (
								<Row label={`Saved vs ${plan?.directBuyMethod === "trader" ? "trader" : "flea"}`}>
									<span className="text-success">{formatRoundedRoubles(recipeSavings)}</span>
								</Row>
							)}
							{(plan?.durationSeconds ?? 0) > 0 && (
								<Row label={`${method === "craft" ? "Craft" : "Route"} time`}>
									{formatDuration(plan?.durationSeconds ?? 0)}
									{(plan?.batches ?? 0) > 1 ? ` · ${plan?.batches} batches` : ""}
								</Row>
							)}
						</>
					)}
				</span>

				{lockReasons.length > 0 && (
					<span className="mt-3 block border-t border-highlight/10 pt-2.5">
						<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
							{lockReasons.length > 1 ? "Locked reasons" : "Locked reason"}
						</span>
						<span className="block space-y-1">
							{lockReasons.map((reason) => (
								<span
									key={`${reason.text}:${reason.questId ?? ""}`}
									className={`flex items-center gap-1.5 leading-relaxed ${reason.tone === "problem" ? "text-danger" : "text-foreground"}`}
								>
									<LockKeyhole
										aria-hidden
										className={`size-3 shrink-0 ${reason.tone === "problem" ? "text-danger" : "text-warning"}`}
									/>
									{reason.questId ? (
										<span>
											Complete{" "}
											<QuestLink
												className="underline decoration-dotted hover:text-brand"
												questId={reason.questId}
												name={questName(reason.questId)}
											/>
										</span>
									) : (
										reason.text
									)}
								</span>
							))}
						</span>
					</span>
				)}
			</span>
			{recipePreview && <RecipePreviewCard preview={recipePreview} routeContext={routeContext} />}
		</span>
	);
}
