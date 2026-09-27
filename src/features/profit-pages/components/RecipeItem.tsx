"use client";

import { useUIStore } from "@/lib/stores/useUIStore";
import { useProfitPricingContext } from "./ProfitPricingContext";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import {
	getItemBuyPrice,
	type LockReason,
	type AcquisitionPlan,
	type ManualPriceOverride,
} from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { GoToRecipeHandler, PriceChangeHandler, RecipePreviewData, RouteContext, RouteMethod } from "../types";
import { formatCompactPrice, formatDuration, formatQuantity, formatRoundedRoubles } from "../utils/formatters";
import { acquisitionRouteKey, describeRoute, getPlanRecipePreview, selectAcquisitionRoute } from "../utils/recipes";
import { LockReasons } from "./LockReasons";
import { InfoHint } from "./InfoHint";
import { InlineItemPrice } from "./InlineItemPrice";
import { useRecipeItemHover } from "./RecipeItemHoverProvider";
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
	onGoToRecipe,
	recipePreview,
	onRouteChange,
	baseRouteKey,
	lockReasons = [],
	sellValueIsEstimate,
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
	onGoToRecipe?: GoToRecipeHandler;
	recipePreview?: RecipePreviewData;
	onRouteChange?: (routeKey: string) => void;
	baseRouteKey?: string;
	lockReasons?: LockReason[];
	sellValueIsEstimate?: boolean;
}) {
	const pricingContext = useProfitPricingContext();
	const reasons =
		method === "unavailable" ? [{ kind: "unavailable" as const, message: "No available route" }] : lockReasons;
	const hover = useRecipeItemHover();
	const routeDetail = detail ?? (plan ? describeRoute(plan, routeContext) : null);
	const unitRoutePrice = totalPrice === null || count <= 0 ? null : totalPrice / count;
	const directUnitPrice = item ? getItemBuyPrice(item, overrides, pricingContext) : null;
	const cheapestDirectTotal = plan?.directBuyCost ?? (directUnitPrice === null ? null : directUnitPrice * count);
	const resolvedRecipePreview = recipePreview ?? getPlanRecipePreview(plan, routeContext);
	const theoreticalAlternative = plan?.alternatives.find(
		(alternative) =>
			alternative.method === plan.theoreticalMethod && alternative.theoreticalCost === plan.theoreticalCost,
	);
	const theoreticalPlan =
		plan && theoreticalAlternative
			? selectAcquisitionRoute(plan, acquisitionRouteKey(theoreticalAlternative))
			: undefined;
	const theoreticalRecipePreview = getPlanRecipePreview(theoreticalPlan, routeContext);
	const canGoToRecipe = Boolean(
		compactLine && onGoToRecipe && plan?.sourceId && (plan.method === "barter" || plan.method === "craft"),
	);
	const routeSavingsTotal =
		plan && (method === "barter" || method === "craft") && cheapestDirectTotal !== null && unitRoutePrice !== null
			? cheapestDirectTotal - unitRoutePrice * count
			: null;
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
		const gap = 12;
		const hoverWidth = Math.min(resolvedRecipePreview || theoreticalRecipePreview ? 660 : 320, window.innerWidth - 16);
		const preferredLeft =
			clientX + gap + hoverWidth <= window.innerWidth - 8 ? clientX + gap : clientX - hoverWidth - gap;
		const placeAbove = clientY > window.innerHeight / 2;
		hover.show({
			position: {
				left: Math.max(8, Math.min(preferredLeft, window.innerWidth - hoverWidth - 8)),
				placeAbove,
				verticalOffset: placeAbove ? window.innerHeight - clientY + gap : clientY + gap,
			},
			item,
			count,
			method,
			totalPrice,
			priceKind,
			plan,
			overrides,
			routeContext,
			routeDetail,
			recipePreview: resolvedRecipePreview,
			theoreticalRecipePreview,
			theoreticalSavings:
				plan?.totalCost != null && plan.theoreticalCost != null ? plan.totalCost - plan.theoreticalCost : null,
			showRouteIcon,
		});
	}
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
		<span
			className={`flex flex-col ${fillColumn ? "h-full min-h-[72px]" : ""} ${reasons.length ? "bg-danger-surface/50" : emphasized && fillColumn ? "bg-brand/[0.07]" : ""}`}
		>
			<span
				className={`group/item relative flex shrink-0 items-center ${compactLine ? "h-9 w-full gap-1.5 pr-1 hover:bg-highlight/[0.025]" : `min-h-[72px] gap-1.5 px-1 ${fillColumn ? "w-full" : "w-40"} ${fillColumn ? "" : emphasized ? "bg-brand/[0.07]" : "bg-shadow/10"}`}`}
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
							/>
						) : (
							showRouteIcon && <RouteIcon method={method} rowRail />
						)}
						<RecipeItemLink
							item={item}
							linkProps={itemLinkProps}
							className="relative ml-0.5 flex size-8 shrink-0 items-center justify-center transition hover:bg-highlight/10"
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
						</RecipeItemLink>
						<span className="min-w-0 truncate text-[11px] font-medium text-foreground" title={item?.name}>
							{item?.name ?? "Unknown item"}
						</span>
						{plan?.isTool && (
							<span className="shrink-0 rounded-[3px] bg-info px-1 py-0.5 text-[7px] font-black uppercase text-inverse">
								tool
							</span>
						)}
						<span className="shrink-0 text-[10px] text-muted-foreground">—</span>
						<span className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatQuantity(count)} ×</span>
						<span className="shrink-0 font-mono text-[10px]">
							{plan?.isTool ? (
								<span className="text-info">cost excluded</span>
							) : (
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
							)}
						</span>
						{(routeSavingsTotal ?? 0) > 0 || (plan?.durationSeconds ?? 0) > 0 || canGoToRecipe ? (
							<span className="ml-auto flex shrink-0 items-center gap-1.5">
								{(routeSavingsTotal ?? 0) > 0 && cheapestDirectTotal !== null && plan?.totalCost !== null && (
									<span className="flex items-center gap-0.5 whitespace-nowrap text-[9px] text-warning">
										{method === "craft" ? "Craft" : "Barter"} saves {formatCompactPrice(routeSavingsTotal)}
										<InfoHint
											title={`${method === "craft" ? "Crafting" : "Bartering"} saves ${formatRoundedRoubles(routeSavingsTotal)}`}
											onShow={hover.close}
										>
											<span className="block">
												{method === "craft" ? "Crafting" : "Bartering for"} {formatQuantity(count)} ×{" "}
												{item?.name ?? "this item"} costs{" "}
												<strong className="text-foreground">{formatRoundedRoubles(plan?.totalCost ?? null)}</strong>.
											</span>
											<span className="mt-1 block">
												The cheapest eligible direct purchase for the same quantity costs{" "}
												<strong className="text-foreground">{formatRoundedRoubles(cheapestDirectTotal)}</strong>.
											</span>
										</InfoHint>
									</span>
								)}
								{(plan?.durationSeconds ?? 0) > 0 && (
									<span className="font-mono text-[9px] text-warning">
										{formatDuration(plan?.durationSeconds ?? 0)}
									</span>
								)}
								{canGoToRecipe && plan?.sourceId && (plan.method === "barter" || plan.method === "craft") && (
									<button
										type="button"
										title={`Go to ${plan.method} recipe`}
										aria-label={`Go to ${plan.method} recipe for ${item?.name ?? "item"}`}
										onClick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											hover.close();
											onGoToRecipe?.(plan.method as "barter" | "craft", plan.sourceId as string);
										}}
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
						</RecipeItemLink>
						<span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
							<span
								className="w-full truncate text-[11px] font-medium leading-tight text-foreground"
								title={item?.name}
							>
								{item?.shortName ?? item?.name ?? "Unknown item"}
							</span>
							<span className="font-mono text-[10px] text-muted-foreground">Quantity ×{formatQuantity(count)}</span>
							<span className="font-mono text-[10px]">
								{plan?.isTool ? (
									<span className="text-info">Cost excluded</span>
								) : (
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
								)}
							</span>
						</span>
					</>
				)}
			</span>
			<span title={method === "unavailable" ? "See route options for details" : undefined}>
				<LockReasons reasons={reasons} showIcon={priceKind === "sell"} />
			</span>
		</span>
	);
}

/** Opens the item dialog; the recipe hover card (not EntityPreview) is its preview. */
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
