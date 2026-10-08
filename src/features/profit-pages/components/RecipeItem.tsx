"use client";

import { useUIStore } from "@/lib/stores/useUIStore";
import { useId, useState } from "react";
import { useProfitPricingContext } from "./ProfitPricingContext";
import { ItemImage } from "@/components/entities/item-image";
import { ChevronDown, ChevronRight, ExternalLink, ListTree, LockKeyhole } from "lucide-react";
import {
	getItemBuyPrice,
	type LockReason,
	type AcquisitionPlan,
	type ManualPriceOverride,
} from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { GoToRecipeHandler, PriceChangeHandler, RecipePreviewData, RouteContext, RouteMethod } from "../types";
import { formatCompactPrice, formatDuration, formatQuantity, formatRoundedRoubles } from "../utils/formatters";
import { acquisitionRouteKey, getPlanRecipePreview } from "../utils/recipes";
import { LockIndicator, useLockChips } from "./LockIndicator";
import { LockChipList } from "./RecipeRequirements";
import { RecipeChainBranch } from "./RecipeChain";
import { InfoHint } from "./InfoHint";
import { InlineItemPrice } from "./InlineItemPrice";
import { preloadHoverImage, useHoverPreview } from "@/components/ui/hover-preview-provider";
import { RecipeItemHoverCard } from "./RecipeItemHoverCard";
import { RouteIcon } from "./RouteIcon";
import { RouteSelector } from "./RouteSelector";
import { itemImageUrl } from "@/lib/utils/item-images";

export function RecipeItem({
	item,
	count,
	method,
	totalPrice,
	priceKind,
	plan,
	overrides,
	onPriceChange,
	routeContext,
	detail,
	showRouteIcon = true,
	compactLine = false,
	onGoToRecipe,
	recipePreview,
	onRouteChange,
	baseRouteKey,
	recipeCost,
	lockReasons = [],
	sellValueIsEstimate,
}: {
	item?: ItemSummary;
	count: number;
	method: RouteMethod;
	totalPrice: number | null;
	priceKind: "buy" | "sell";
	plan?: AcquisitionPlan;
	overrides: Record<string, ManualPriceOverride>;
	onPriceChange: PriceChangeHandler;
	routeContext: RouteContext;
	detail?: string;
	showRouteIcon?: boolean;
	compactLine?: boolean;
	onGoToRecipe?: GoToRecipeHandler;
	recipePreview?: RecipePreviewData;
	onRouteChange?: (routeKey: string) => void;
	baseRouteKey?: string;
	recipeCost?: number | null;
	lockReasons?: LockReason[];
	sellValueIsEstimate?: boolean;
}) {
	const pricingContext = useProfitPricingContext();
	const reasons =
		method === "unavailable" ? [{ kind: "unavailable" as const, message: "No available route" }] : lockReasons;
	const lockChips = useLockChips(reasons);
	const lockProblem = lockChips.some((chip) => chip.tone === "problem");
	const [detailsOpen, setDetailsOpen] = useState(false);
	const hover = useHoverPreview();
	const hoverKey = useId();
	const routeDetail = detail ?? null;
	const unitRoutePrice = totalPrice === null || count <= 0 ? null : totalPrice / count;
	const directUnitPrice = item ? getItemBuyPrice(item, overrides, pricingContext) : null;
	const cheapestDirectTotal = plan?.directBuyCost ?? (directUnitPrice === null ? null : directUnitPrice * count);
	const resolvedRecipePreview =
		recipePreview ??
		getPlanRecipePreview(plan, routeContext, {
			...pricingContext,
			overrides,
		});
	const canGoToRecipe = Boolean(
		compactLine && onGoToRecipe && plan?.sourceId && (plan.method === "barter" || plan.method === "craft"),
	);
	const routeSavingsTotal =
		plan && (method === "barter" || method === "craft") && cheapestDirectTotal !== null && unitRoutePrice !== null
			? cheapestDirectTotal - unitRoutePrice * count
			: null;
	const hasSavings = (routeSavingsTotal ?? 0) > 0 && cheapestDirectTotal !== null && plan?.totalCost !== null;
	const recipeMethod = plan?.method === "barter" || plan?.method === "craft" ? plan.method : null;
	const hasChain = Boolean(recipeMethod && plan?.children.length);
	// Compact cards expand an ingredient in place to show its locks, nested ingredients and recipe link.
	const expandable = compactLine && (lockChips.length > 0 || hasChain || canGoToRecipe);
	function goToRecipe(event: React.MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		hover.close();
		if (recipeMethod && plan?.sourceId) onGoToRecipe?.(recipeMethod, plan.sourceId);
	}
	function updateHoverPosition(event: React.MouseEvent<HTMLSpanElement>) {
		hover.cancelClose();
		if ((event.target as HTMLElement).closest("[data-isolated-hover='true']")) {
			hover.close();
			return;
		}
		showHoverAt(event.clientX, event.clientY);
	}
	/** Keyboard focus shows the same card, anchored to the focused item link. */
	function showHoverForFocus(event: React.FocusEvent<HTMLElement>) {
		if (!event.currentTarget.matches(":focus-visible")) return;
		const bounds = event.currentTarget.getBoundingClientRect();
		showHoverAt(bounds.right, bounds.bottom);
	}
	function showHoverAt(clientX: number, clientY: number) {
		const data = {
			item,
			count,
			method,
			totalPrice,
			priceKind,
			plan,
			recipeCost,
			overrides,
			routeContext,
			routeDetail,
			recipePreview: resolvedRecipePreview,
			showRouteIcon,
			pricingContext,
		};
		hover.show({
			key: hoverKey,
			content: <RecipeItemHoverCard {...data} onClose={hover.close} onKeepOpen={hover.cancelClose} />,
			clientX,
			clientY,
			width: resolvedRecipePreview ? 660 : 320,
			prepare: () => preloadHoverImage(item ? itemImageUrl(item) : null),
		});
	}
	const hasDuration = (plan?.durationSeconds ?? 0) > 0;
	const savingsLabel = hasSavings && (
		<span className="flex items-center gap-0.5 whitespace-nowrap">
			{method === "craft" ? "Craft" : "Barter"} saves {formatCompactPrice(routeSavingsTotal)}
			<InfoHint
				title={`${method === "craft" ? "Crafting" : "Bartering"} saves ${formatRoundedRoubles(routeSavingsTotal)}`}
				onShow={hover.close}
			>
				<span className="block">
					{method === "craft" ? "Crafting" : "Bartering for"} {formatQuantity(count)} × {item?.name ?? "this item"}{" "}
					costs <strong className="text-foreground">{formatRoundedRoubles(plan?.totalCost ?? null)}</strong>.
				</span>
				<span className="mt-1 block">
					The cheapest eligible direct purchase for the same quantity costs{" "}
					<strong className="text-foreground">{formatRoundedRoubles(cheapestDirectTotal)}</strong>.
				</span>
			</InfoHint>
		</span>
	);
	const durationLabel = hasDuration && <span className="font-mono">{formatDuration(plan?.durationSeconds ?? 0)}</span>;
	const itemLinkProps = {
		onClick: (event: React.MouseEvent) => {
			event.stopPropagation();
			hover.close();
		},
		onFocus: showHoverForFocus,
		onBlur: hover.scheduleClose,
		onKeyDown: (event: React.KeyboardEvent) => {
			if (event.key === "Escape") hover.close();
		},
	};
	return (
		<span className="flex min-w-0 flex-col">
			<span
				className={`group/item relative flex shrink-0 items-center ${compactLine ? "h-10 w-full gap-2 pr-1 hover:bg-highlight/[0.025] max-lg:h-12" : "w-full gap-2.5"}`}
				onMouseEnter={updateHoverPosition}
				onMouseMove={updateHoverPosition}
				onMouseLeave={hover.scheduleClose}
			>
				{compactLine ? (
					<>
						{showRouteIcon &&
						plan &&
						onRouteChange &&
						(plan.alternatives.length > 0 || (plan.lockedAlternatives ?? []).length > 0) ? (
							<RouteSelector
								plan={plan}
								item={item}
								routeContext={routeContext}
								onSelect={onRouteChange}
								onOpen={hover.close}
								changedFromBase={baseRouteKey !== undefined && baseRouteKey !== acquisitionRouteKey(plan)}
								bestRouteKey={baseRouteKey}
							/>
						) : (
							showRouteIcon && <RouteIcon method={method} rowRail />
						)}
						<RecipeItemLink
							item={item}
							linkProps={itemLinkProps}
							className="relative ml-0.5 flex size-8 shrink-0 items-center justify-center transition hover:bg-highlight/10"
						>
							{item ? (
								<ItemImage item={item} size={32} className="size-8 object-contain" />
							) : (
								<span className="size-8" />
							)}
						</RecipeItemLink>
						{/* Below lg: name above figures plus badges, one tap target. lg: name and figures above a
						    muted savings/duration line. xl: the wrappers dissolve into one line. */}
						<span className="relative flex h-full min-w-0 flex-1 items-center gap-2 lg:contents">
							{expandable && (
								<button
									type="button"
									aria-expanded={detailsOpen}
									aria-label={`${detailsOpen ? "Hide" : "Show"} details for ${item?.name ?? "item"}`}
									onClick={() => setDetailsOpen((value) => !value)}
									className="absolute inset-0 rounded-sm focus-visible:outline-2 focus-visible:outline-brand lg:hidden"
								/>
							)}
							<span className="flex min-w-0 flex-1 flex-col justify-center xl:contents">
								<span className="contents lg:flex lg:min-w-0 lg:items-center lg:gap-2 xl:contents">
									<span className="flex min-w-0 items-center gap-2 lg:contents">
										<span className="min-w-0 truncate text-[13px] font-medium text-foreground" title={item?.name}>
											{item?.shortName ?? item?.name ?? "Unknown item"}
										</span>
										{plan?.isTool && (
											<span className="shrink-0 rounded-[3px] bg-info px-1 py-0.5 text-[7px] font-black uppercase text-inverse">
												tool
											</span>
										)}
									</span>
									{!plan?.isTool && (
										<span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap lg:contents">
											<span className="shrink-0 text-xs text-muted-foreground max-lg:hidden">—</span>
											<span className="shrink-0 font-mono text-xs text-muted-foreground">
												{formatQuantity(count)} ×
											</span>
											<span className="relative z-[1] shrink-0 font-mono text-xs">
												<InlineItemPrice
													item={item}
													kind={priceKind}
													buyMethod={method}
													totalPrice={totalPrice}
													displayPrice={unitRoutePrice}
													overrides={overrides}
													onPriceChange={onPriceChange}
													onWarningShow={hover.close}
													editable={method === "flea" || method === "sell" || method === "unavailable"}
												/>
											</span>
											{hasSavings && (
												<span className="truncate text-[11px] text-warning lg:hidden">
													· Saves {formatCompactPrice(routeSavingsTotal)}
												</span>
											)}
											{hasDuration && (
												<span className="shrink-0 font-mono text-[11px] text-warning lg:hidden">
													· {formatDuration(plan?.durationSeconds ?? 0)}
												</span>
											)}
										</span>
									)}
								</span>
								{(hasSavings || hasDuration) && (
									<span className="hidden min-w-0 items-center gap-1.5 overflow-hidden text-[11px] leading-tight text-warning/75 lg:flex xl:hidden">
										{savingsLabel}
										{savingsLabel && durationLabel && <span aria-hidden>·</span>}
										{durationLabel}
									</span>
								)}
							</span>
							{expandable && (
								<span aria-hidden className="flex shrink-0 items-center gap-1.5 lg:hidden">
									{lockChips.length > 0 && (
										<LockKeyhole className={`size-3.5 ${lockProblem ? "text-danger" : "text-warning"}`} />
									)}
									{hasChain && <ListTree className="size-3.5 text-muted-foreground" />}
									<ChevronDown
										className={`size-4 text-muted-foreground transition-transform ${detailsOpen ? "rotate-180" : ""}`}
									/>
								</span>
							)}
						</span>
						<LockIndicator chips={lockChips} className="max-lg:hidden" />
						{hasSavings || hasDuration || canGoToRecipe ? (
							<span className="ml-auto flex shrink-0 items-center gap-1.5 max-lg:hidden">
								{(hasSavings || hasDuration) && (
									<span className="flex items-center gap-1.5 text-[11px] text-warning max-xl:hidden">
										{savingsLabel}
										{durationLabel}
									</span>
								)}
								{canGoToRecipe && (
									<button
										type="button"
										title={`Go to ${recipeMethod} recipe`}
										aria-label={`Go to ${recipeMethod} recipe for ${item?.name ?? "item"}`}
										onClick={goToRecipe}
										className="flex size-6 shrink-0 items-center justify-center rounded border border-highlight/10 bg-shadow/70 text-muted-foreground opacity-0 transition hover:border-brand/50 hover:text-brand group-hover/item:opacity-100 focus:opacity-100"
									>
										<ExternalLink className="size-3.5" />
									</button>
								)}
							</span>
						) : null}
					</>
				) : (
					<>
						<RecipeItemLink
							item={item}
							linkProps={itemLinkProps}
							className="relative flex size-12 shrink-0 items-center justify-center bg-highlight/[0.025] transition hover:bg-highlight/10"
						>
							{showRouteIcon && <RouteIcon method={method} />}
							{plan?.isTool && (
								<span className="absolute -right-0.5 -top-0.5 z-10 rounded-[3px] bg-info px-1 py-0.5 text-[7px] font-black uppercase text-inverse shadow">
									tool
								</span>
							)}
							{item ? (
								<ItemImage item={item} size={48} className="size-12 object-contain" />
							) : (
								<span className="size-12" />
							)}
						</RecipeItemLink>
						<span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
							<span
								className="w-full truncate text-[13px] font-medium leading-tight text-foreground"
								title={item?.name}
							>
								{item?.shortName ?? item?.name ?? "Unknown item"}
							</span>
							{!plan?.isTool && (
								<>
									<span className="font-mono text-[11px] text-muted-foreground">Quantity ×{formatQuantity(count)}</span>
									<span className="font-mono text-xs">
										<InlineItemPrice
											item={item}
											kind={priceKind}
											buyMethod={method}
											sellValueIsEstimate={sellValueIsEstimate}
											totalPrice={totalPrice}
											overrides={overrides}
											onPriceChange={onPriceChange}
											onWarningShow={hover.close}
											editable={
												priceKind === "sell" || method === "flea" || method === "sell" || method === "unavailable"
											}
										/>
									</span>
								</>
							)}
						</span>
					</>
				)}
			</span>
			{detailsOpen && expandable && (
				<span className="mb-1.5 flex w-full flex-col gap-1.5 rounded-sm bg-shadow/20 p-2 text-[11px] lg:hidden">
					{lockChips.length > 0 && <LockChipList chips={lockChips} />}
					{hasChain && plan && (
						<RecipeChainBranch plan={plan} routeContext={routeContext} onGoToRecipe={onGoToRecipe ?? (() => {})} />
					)}
					{canGoToRecipe && (
						<button
							type="button"
							onClick={goToRecipe}
							className="flex h-8 items-center gap-0.5 self-start font-medium capitalize text-foreground/90 underline decoration-foreground/40 underline-offset-2"
						>
							View {recipeMethod}
							<ChevronRight aria-hidden className="size-3.5" />
						</button>
					)}
				</span>
			)}
		</span>
	);
}

function RecipeItemLink({
	item,
	linkProps,
	className,
	children,
}: {
	item?: ItemSummary;
	linkProps: Pick<React.ComponentProps<"button">, "onClick" | "onFocus" | "onBlur" | "onKeyDown">;
	className: string;
	children: React.ReactNode;
}) {
	const openItemDetail = useUIStore((state) => state.openItemDetail);
	if (!item) return <span className={className}>{children}</span>;
	return (
		<button
			{...linkProps}
			type="button"
			aria-haspopup="dialog"
			onClick={(event) => {
				linkProps.onClick?.(event);
				openItemDetail(item);
			}}
			aria-label={`Open ${item.name} details`}
			className={`${className} cursor-pointer focus-visible:outline-2 focus-visible:outline-brand`}
		>
			{children}
		</button>
	);
}
